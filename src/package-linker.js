/* @flow */

import type {Manifest} from './types.js';
import type PackageReference from './package-reference.js';
import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {HoistManifestTuples, HoistManifestTuple} from './package-hoister.js';
import type {CopyQueueItem} from './util/fs.js';
import type {InstallArtifacts} from './package-install-scripts.js';
import PackageHoister from './package-hoister.js';
import * as constants from './constants.js';
import * as promise from './util/promise.js';
import {normalizePattern} from './util/normalize-pattern.js';
import {entries} from './util/misc.js';
import * as fs from './util/fs.js';
import lockMutex from './util/mutex.js';
import {satisfiesWithPrereleases} from './util/semver.js';
import WorkspaceLayout from './workspace-layout.js';

const invariant = require('invariant');
const cmdShim = require('@zkochan/cmd-shim');
const path = require('path');
const semver = require('semver');
// Concurrency for creating bin links disabled because of the issue #1961
const linkBinConcurrency = 1;

type DependencyPairs = Array<{
  dep: Manifest,
  loc: string,
}>;

export async function linkBin(src: string, dest: string): Promise<void> {
  if (process.platform === 'win32') {
    const unlockMutex = await lockMutex(src);
    try {
      await cmdShim(src, dest, {createPwshFile: false});
    } finally {
      unlockMutex();
    }
  } else {
    await fs.mkdirp(path.dirname(dest));
    await fs.symlink(src, dest);
    await fs.chmod(dest, '755');
  }
}

export default class PackageLinker {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config = config;
    this.artifacts = {};
    this.topLevelBinLinking = true;
    this.unplugged = [];
  }

  artifacts: InstallArtifacts;
  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;
  topLevelBinLinking: boolean;
  unplugged: Array<string>;
  _treeHash: ?Map<string, HoistManifestTuple>;

  setArtifacts(artifacts: InstallArtifacts) {
    this.artifacts = artifacts;
  }

  setTopLevelBinLinking(topLevelBinLinking: boolean) {
    this.topLevelBinLinking = topLevelBinLinking;
  }

  async linkSelfDependencies(
    pkg: Manifest,
    pkgLoc: string,
    targetBinLoc: string,
    override: boolean = false,
  ): Promise<void> {
    targetBinLoc = path.join(targetBinLoc, '.bin');
    await fs.mkdirp(targetBinLoc);
    targetBinLoc = await fs.realpath(targetBinLoc);
    pkgLoc = await fs.realpath(pkgLoc);
    for (const [scriptName, scriptCmd] of entries(pkg.bin)) {
      const dest = path.join(targetBinLoc, scriptName);
      const src = path.join(pkgLoc, scriptCmd);
      if (!await fs.exists(src)) {
        if (!override) {
          // TODO maybe throw an error
          continue;
        }
      }
      await linkBin(src, dest);
    }
  }

  async linkBinDependencies(pkg: Manifest, dir: string): Promise<void> {
    const deps: DependencyPairs = [];

    const ref = pkg._reference;
    invariant(ref, 'Package reference is missing');

    const remote = pkg._remote;
    invariant(remote, 'Package remote is missing');

    // link up `bin scripts` in `dependencies`
    for (const pattern of ref.dependencies) {
      const dep = this.resolver.getStrictResolvedPattern(pattern);
      if (
        // Missing locations means not installed inside node_modules
        dep._reference &&
        dep._reference.locations.length &&
        dep.bin &&
        Object.keys(dep.bin).length
      ) {
        const loc = await this.findNearestInstalledVersionOfPackage(dep, dir);
        deps.push({dep, loc});
      }
    }

    // link up the `bin` scripts in bundled dependencies
    if (pkg.bundleDependencies) {
      for (const depName of pkg.bundleDependencies) {
        const locs = ref.locations.map(loc => path.join(loc, this.config.getFolder(pkg), depName));
        try {
          const dep = await this.config.readManifest(locs[0], remote.registry); //all of them should be the same

          if (dep.bin && Object.keys(dep.bin).length) {
            deps.push(...locs.map(loc => ({dep, loc})));
          }
        } catch (ex) {
          if (ex.code !== 'ENOENT') {
            throw ex;
          }
          // intentionally ignoring ENOENT error.
          // bundledDependency either does not exist or does not contain a package.json
        }
      }
    }

    // no deps to link
    if (!deps.length) {
      return;
    }

    // write the executables
    for (const {dep, loc} of deps) {
      if (dep._reference && dep._reference.locations.length) {
        invariant(!dep._reference.isPlugnplay, "Plug'n'play packages should not be referenced here");
        await this.linkSelfDependencies(dep, loc, dir);
      }
    }
  }

  //find the installation location of ref that would be used in binLoc based on node module resolution
  async findNearestInstalledVersionOfPackage(pkg: Manifest, binLoc: string): Promise<string> {
    const ref = pkg._reference;
    invariant(ref, 'expected pkg reference for ' + pkg.name);
    const moduleFolder = this.config.getFolder(pkg);
    await fs.mkdirp(binLoc);
    const realBinLoc = await fs.realpath(binLoc);

    const allLocations = [...ref.locations];
    const realLocations = await Promise.all(ref.locations.map(loc => fs.realpath(loc)));
    realLocations.forEach(loc => allLocations.indexOf(loc) !== -1 || allLocations.push(loc));

    const locationBinLocPairs = allLocations.map(loc => [loc, binLoc]);
    if (binLoc !== realBinLoc) {
      locationBinLocPairs.push(...allLocations.map(loc => [loc, realBinLoc]));
    }

    const distancePairs = locationBinLocPairs.map(([loc, curBinLoc]) => {
      let distance = 0;
      let curLoc = curBinLoc;
      let notFound = false;

      while (path.join(curLoc, ref.name) !== loc && path.join(curLoc, moduleFolder, ref.name) !== loc) {
        const next = path.dirname(curLoc);
        if (curLoc === next) {
          notFound = true;
          break;
        }

        distance++;
        curLoc = next;
      }
      return notFound ? null : [loc, distance];
    });

    //remove items where path was not found
    const filteredDistancePairs: any = distancePairs.filter(d => d);
    (filteredDistancePairs: Array<[string, number]>);

    invariant(filteredDistancePairs.length > 0, `could not find a copy of ${pkg.name} to link in ${binLoc}`);

    //get smallest distance from package location
    const minItem = filteredDistancePairs.reduce((min, cur) => {
      return cur[1] < min[1] ? cur : min;
    });

    invariant(minItem[1] >= 0, 'could not find a target for bin dir of ' + minItem.toString());
    return minItem[0];
  }

  getFlatHoistedTree(
    patterns: Array<string>,
    workspaceLayout?: WorkspaceLayout,
    {ignoreOptional}: {ignoreOptional: ?boolean} = {},
  ): HoistManifestTuples {
    const hoister = new PackageHoister(this.config, this.resolver, {ignoreOptional, workspaceLayout});
    hoister.seed(patterns);
    if (this.config.focus) {
      hoister.markShallowWorkspaceEntries();
    }
    return hoister.init();
  }

  async copyModules(
    patterns: Array<string>,
    workspaceLayout?: WorkspaceLayout,
    {linkDuplicates, ignoreOptional}: {linkDuplicates: ?boolean, ignoreOptional: ?boolean} = {},
  ): Promise<void> {
    let flatTree = this.getFlatHoistedTree(patterns, workspaceLayout, {ignoreOptional});
    // sorted tree makes file creation and copying not to interfere with each other
    flatTree = flatTree.sort(function(dep1, dep2): number {
      return dep1[0].localeCompare(dep2[0]);
    });

    // list of artifacts in modules to remove from extraneous removal
    const artifactFiles = [];

    const copyQueue: Map<string, CopyQueueItem> = new Map();
    const hardlinkQueue: Map<string, CopyQueueItem> = new Map();
    const hardlinksEnabled = linkDuplicates && (await fs.hardlinksWork(this.config.cwd));

    const copiedSrcs: Map<string, string> = new Map();
    const symlinkPaths: Map<string, string> = new Map();
    for (const [folder, {pkg, loc, isShallow}] of flatTree) {
      const remote = pkg._remote || {type: ''};
      const ref = pkg._reference;
      let dest = folder;
      invariant(ref, 'expected package reference');

      let src = loc;
      let type = '';
      if (remote.type === 'link') {
        // replace package source from incorrect cache location (workspaces and link: are not cached)
        // with a symlink source
        src = remote.reference;
        type = 'symlink';
      } else if (workspaceLayout && remote.type === 'workspace' && !isShallow) {
        src = remote.reference;
        type = 'symlink';
        // to get real path for non hoisted dependencies
        symlinkPaths.set(dest, src);
      } else {
        // backwards compatibility: get build artifacts from metadata
        // does not apply to symlinked dependencies
        const metadata = await this.config.readPackageMetadata(src);
        for (const file of metadata.artifacts) {
          artifactFiles.push(path.join(dest, file));
        }
      }

      for (const [symlink, realpath] of symlinkPaths.entries()) {
        if (dest.indexOf(symlink + path.sep) === 0) {
          // after hoisting we end up with this structure
          // root/node_modules/workspace-package(symlink)/node_modules/package-a
          // fs.copy operations can't copy files through a symlink, so all the paths under workspace-package
          // need to be replaced with a real path, except for the symlink root/node_modules/workspace-package
          dest = dest.replace(symlink, realpath);
        }
      }

      if (this.config.plugnplayEnabled) {
        ref.isPlugnplay = true;
        if (await this._isUnplugged(pkg, ref)) {
          dest = this.config.generatePackageUnpluggedPath(ref);

          // We don't skip the copy if the unplugged package isn't materialized yet
          if (await fs.exists(dest)) {
            ref.addLocation(dest);
            continue;
          }
        } else {
          ref.addLocation(src);
          continue;
        }
      }

      ref.addLocation(dest);

      const integrityArtifacts = this.artifacts[`${pkg.name}@${pkg.version}`];
      if (integrityArtifacts) {
        for (const file of integrityArtifacts) {
          artifactFiles.push(path.join(dest, file));
        }
      }

      const copiedDest = copiedSrcs.get(src);
      if (!copiedDest) {
        // no point to hardlink to a symlink
        if (hardlinksEnabled && type !== 'symlink') {
          copiedSrcs.set(src, dest);
        }
        copyQueue.set(dest, {
          src,
          dest,
          type,
          onFresh() {
            if (ref) {
              ref.setFresh(true);
            }
          },
        });
      } else {
        hardlinkQueue.set(dest, {
          src: copiedDest,
          dest,
          onFresh() {
            if (ref) {
              ref.setFresh(true);
            }
          },
        });
      }
    }

    const possibleExtraneous: Set<string> = new Set();
    const scopedPaths: Set<string> = new Set();

    const findExtraneousFiles = async basePath => {
      for (const folder of this.config.registryFolders) {
        const loc = path.resolve(basePath, folder);

        if (await fs.exists(loc)) {
          const files = await fs.readdir(loc);

          for (const file of files) {
            const filepath = path.join(loc, file);

            // it's a scope, not a package
            if (file[0] === '@') {
              scopedPaths.add(filepath);

              for (const subfile of await fs.readdir(filepath)) {
                possibleExtraneous.add(path.join(filepath, subfile));
              }
            } else if (file[0] === '.' && file !== '.bin') {
              if (!(await fs.lstat(filepath)).isDirectory()) {
                possibleExtraneous.add(filepath);
              }
            } else {
              possibleExtraneous.add(filepath);
            }
          }
        }
      }
    };

    await findExtraneousFiles(this.config.lockfileFolder);
    if (workspaceLayout) {
      for (const workspaceName of Object.keys(workspaceLayout.workspaces)) {
        await findExtraneousFiles(workspaceLayout.workspaces[workspaceName].loc);
      }
    }

    // If an Extraneous is an entry created via "yarn link", we prevent it from being overwritten.
    // Unfortunately, the only way we can know if they have been created this way is to check if they
    // are symlinks - problem is that it then conflicts with the newly introduced "link:" protocol,
    // which also creates symlinks :( a somewhat weak fix is to check if the symlink target is registered
    // inside the linkFolder, in which case we assume it has been created via "yarn link". Otherwise, we
    // assume it's a link:-managed dependency, and overwrite it as usual.
    const linkTargets = new Map();

    let linkedModules;
    try {
      linkedModules = await fs.readdir(this.config.linkFolder);
    } catch (err) {
      if (err.code === 'ENOENT') {
        linkedModules = [];
      } else {
        throw err;
      }
    }

    // TODO: Consolidate this logic with `this.config.linkedModules` logic
    for (const entry of linkedModules) {
      const entryPath = path.join(this.config.linkFolder, entry);
      const stat = await fs.lstat(entryPath);

      if (stat.isSymbolicLink()) {
        try {
          const entryTarget = await fs.realpath(entryPath);
          linkTargets.set(entry, entryTarget);
        } catch (err) {
          this.reporter.warn(this.reporter.lang('linkTargetMissing', entry));
          await fs.unlink(entryPath);
        }
      } else if (stat.isDirectory() && entry[0] === '@') {
        // if the entry is directory beginning with '@', then we're dealing with a package scope, which
        // means we must iterate inside to retrieve the package names it contains
        const scopeName = entry;

        for (const entry2 of await fs.readdir(entryPath)) {
          const entryPath2 = path.join(entryPath, entry2);
          const stat2 = await fs.lstat(entryPath2);

          if (stat2.isSymbolicLink()) {
            const packageName = `${scopeName}/${entry2}`;
            try {
              const entryTarget = await fs.realpath(entryPath2);
              linkTargets.set(packageName, entryTarget);
            } catch (err) {
              this.reporter.warn(this.reporter.lang('linkTargetMissing', packageName));
              await fs.unlink(entryPath2);
            }
          }
        }
      }
    }

    for (const loc of possibleExtraneous) {
      let packageName = path.basename(loc);
      const scopeName = path.basename(path.dirname(loc));

      if (scopeName[0] === `@`) {
        packageName = `${scopeName}/${packageName}`;
      }

      if (
        (await fs.lstat(loc)).isSymbolicLink() &&
        linkTargets.has(packageName) &&
        linkTargets.get(packageName) === (await fs.realpath(loc))
      ) {
        possibleExtraneous.delete(loc);
        copyQueue.delete(loc);
      }
    }

    //
    let tick;
    await fs.copyBulk(Array.from(copyQueue.values()), this.reporter, {
      possibleExtraneous,
      artifactFiles,

      ignoreBasenames: [constants.METADATA_FILENAME, constants.TARBALL_FILENAME, '.bin'],

      onStart: (num: number) => {
        tick = this.reporter.progress(num);
      },

      onProgress(src: string) {
        if (tick) {
          tick();
        }
      },
    });

    await fs.hardlinkBulk(Array.from(hardlinkQueue.values()), this.reporter, {
      possibleExtraneous,
      artifactFiles,

      onStart: (num: number) => {
        tick = this.reporter.progress(num);
      },

      onProgress(src: string) {
        if (tick) {
          tick();
        }
      },
    });

    // remove all extraneous files that weren't in the tree
    for (const loc of possibleExtraneous) {
      this.reporter.verbose(this.reporter.lang('verboseFileRemoveExtraneous', loc));
      await fs.unlink(loc);
    }

    // remove any empty scoped directories
    for (const scopedPath of scopedPaths) {
      const files = await fs.readdir(scopedPath);
      if (files.length === 0) {
        await fs.unlink(scopedPath);
      }
    }

    // create binary links
    if (this.config.getOption('bin-links') && this.config.binLinks !== false) {
      const topLevelDependencies = this.determineTopLevelBinLinkOrder(flatTree);
      const tickBin = this.reporter.progress(flatTree.length + topLevelDependencies.length);

      // create links in transient dependencies
      await promise.queue(
        flatTree,
        async ([dest, {pkg, isNohoist, parts}]) => {
          if (pkg._reference && pkg._reference.locations.length && !pkg._reference.isPlugnplay) {
            const binLoc = path.join(dest, this.config.getFolder(pkg));
            await this.linkBinDependencies(pkg, binLoc);
            if (isNohoist) {
              // if nohoist, we need to override the binLink to point to the local destination
              const parentBinLoc = this.getParentBinLoc(parts, flatTree);
              await this.linkSelfDependencies(pkg, dest, parentBinLoc, true);
            }
            tickBin();
          }
          tickBin();
        },
        linkBinConcurrency,
      );

      // create links at top level for all dependencies.
      await promise.queue(
        topLevelDependencies,
        async ([dest, {pkg}]) => {
          if (
            pkg._reference &&
            pkg._reference.locations.length &&
            !pkg._reference.isPlugnplay &&
            pkg.bin &&
            Object.keys(pkg.bin).length
          ) {
            let binLoc;
            if (this.config.modulesFolder) {
              binLoc = path.join(this.config.modulesFolder);
            } else {
              binLoc = path.join(this.config.lockfileFolder, this.config.getFolder(pkg));
            }
            await this.linkSelfDependencies(pkg, dest, binLoc);
          }
          tickBin();
        },
        linkBinConcurrency,
      );
    }

    for (const [, {pkg}] of flatTree) {
      await this._warnForMissingBundledDependencies(pkg);
    }
  }

  _buildTreeHash(flatTree: HoistManifestTuples): Map<string, HoistManifestTuple> {
    const hash: Map<string, HoistManifestTuple> = new Map();
    for (const [dest, hoistManifest] of flatTree) {
      const key: string = hoistManifest.parts.join('#');
      hash.set(key, [dest, hoistManifest]);
    }
    this._treeHash = hash;
    return hash;
  }

  getParentBinLoc(parts: Array<string>, flatTree: HoistManifestTuples): string {
    const hash = this._treeHash || this._buildTreeHash(flatTree);
    const parent = parts.slice(0, -1).join('#');
    const tuple = hash.get(parent);
    if (!tuple) {
      throw new Error(`failed to get parent '${parent}' binLoc`);
    }
    const [dest, hoistManifest] = tuple;
    const parentBinLoc = path.join(dest, this.config.getFolder(hoistManifest.pkg));

    return parentBinLoc;
  }

  determineTopLevelBinLinkOrder(flatTree: HoistManifestTuples): HoistManifestTuples {
    const linksToCreate = new Map();
    for (const [dest, hoistManifest] of flatTree) {
      const {pkg, isDirectRequire, isNohoist, isShallow} = hoistManifest;
      const {name} = pkg;

      // nohoist and shallow packages should not be linked at topLevel bin
      if (!isNohoist && !isShallow && (isDirectRequire || (this.topLevelBinLinking && !linksToCreate.has(name)))) {
        linksToCreate.set(name, [dest, hoistManifest]);
      }
    }

    // Sort the array so that direct dependencies will be linked last.
    // Bin links are overwritten if they already exist, so this will cause direct deps to take precedence.
    // If someone finds this to be incorrect later, you could also consider sorting descending by
    //   `linkToCreate.level` which is the dependency tree depth. Direct deps will have level 0 and transitive
    //   deps will have level > 0.
    const transientBins = [];
    const topLevelBins = [];
    for (const linkToCreate of Array.from(linksToCreate.values())) {
      if (linkToCreate[1].isDirectRequire) {
        topLevelBins.push(linkToCreate);
      } else {
        transientBins.push(linkToCreate);
      }
    }
    return [...transientBins, ...topLevelBins];
  }

  resolvePeerModules() {
    for (const pkg of this.resolver.getManifests()) {
      const peerDeps = pkg.peerDependencies;
      const peerDepsMeta = pkg.peerDependenciesMeta;

      if (!peerDeps) {
        continue;
      }

      const ref = pkg._reference;
      invariant(ref, 'Package reference is missing');

      // TODO: We are taking the "shortest" ref tree but there may be multiple ref trees with the same length
      const refTree = ref.requests.map(req => req.parentNames).sort((arr1, arr2) => arr1.length - arr2.length)[0];

      const getLevelDistance = pkgRef => {
        let minDistance = Infinity;
        for (const req of pkgRef.requests) {
          const distance = refTree.length - req.parentNames.length;

          if (distance >= 0 && distance < minDistance && req.parentNames.every((name, idx) => name === refTree[idx])) {
            minDistance = distance;
          }
        }

        return minDistance;
      };

      for (const peerDepName in peerDeps) {
        const range = peerDeps[peerDepName];
        const meta = peerDepsMeta && peerDepsMeta[peerDepName];

        const isOptional = !!(meta && meta.optional);

        const peerPkgs = this.resolver.getAllInfoForPackageName(peerDepName);

        let peerError = 'unmetPeer';
        let resolvedLevelDistance = Infinity;
        let resolvedPeerPkg;
        for (const peerPkg of peerPkgs) {
          const peerPkgRef = peerPkg._reference;
          if (!(peerPkgRef && peerPkgRef.patterns)) {
            continue;
          }
          const levelDistance = getLevelDistance(peerPkgRef);
          if (isFinite(levelDistance) && levelDistance < resolvedLevelDistance) {
            if (this._satisfiesPeerDependency(range, peerPkgRef.version)) {
              resolvedLevelDistance = levelDistance;
              resolvedPeerPkg = peerPkgRef;
            } else {
              peerError = 'incorrectPeer';
            }
          }
        }

        if (resolvedPeerPkg) {
          ref.addDependencies(resolvedPeerPkg.patterns);
          this.reporter.verbose(
            this.reporter.lang(
              'selectedPeer',
              `${pkg.name}@${pkg.version}`,
              `${peerDepName}@${resolvedPeerPkg.version}`,
              resolvedPeerPkg.level,
            ),
          );
        } else if (!isOptional) {
          this.reporter.warn(
            this.reporter.lang(
              peerError,
              `${refTree.join(' > ')} > ${pkg.name}@${pkg.version}`,
              `${peerDepName}@${range}`,
            ),
          );
        }
      }
    }
  }

  _satisfiesPeerDependency(range: string, version: string): boolean {
    return range === '*' || satisfiesWithPrereleases(version, range, this.config.looseSemver);
  }

  async _warnForMissingBundledDependencies(pkg: Manifest): Promise<void> {
    const ref = pkg._reference;
    invariant(ref, 'missing package ref ' + pkg.name);

    if (pkg.bundleDependencies) {
      for (const depName of pkg.bundleDependencies) {
        const locs = ref.locations.map(loc => path.join(loc, this.config.getFolder(pkg), depName));
        const locsExist = await Promise.all(locs.map(loc => fs.exists(loc)));
        if (locsExist.some(e => !e)) {
          //if any of the locs do not exist
          const pkgHuman = `${pkg.name}@${pkg.version}`;
          this.reporter.warn(this.reporter.lang('missingBundledDependency', pkgHuman, depName));
        }
      }
    }
  }

  async _isUnplugged(pkg: Manifest, ref: PackageReference): Promise<boolean> {
    // If an unplugged folder exists for the specified package, we simply use it
    if (await fs.exists(this.config.generatePackageUnpluggedPath(ref))) {
      return true;
    }

    // If the package has a postinstall script, we also unplug it (otherwise they would run into the cache)
    if (
      !this.config.ignoreScripts &&
      pkg.scripts &&
      (pkg.scripts.preinstall || pkg.scripts.install || pkg.scripts.postinstall)
    ) {
      return true;
    }

    // Check whether the user explicitly requested for the package to be unplugged
    return this.unplugged.some(patternToUnplug => {
      const {name, range, hasVersion} = normalizePattern(patternToUnplug);
      const satisfiesSemver = hasVersion ? semver.satisfies(ref.version, range) : true;
      return name === ref.name && satisfiesSemver;
    });
  }

  async init(
    patterns: Array<string>,
    workspaceLayout?: WorkspaceLayout,
    {linkDuplicates, ignoreOptional}: {linkDuplicates: ?boolean, ignoreOptional: ?boolean} = {},
  ): Promise<void> {
    this.resolvePeerModules();
    await this.copyModules(patterns, workspaceLayout, {linkDuplicates, ignoreOptional});

    if (!this.config.plugnplayEnabled) {
      await fs.unlink(`${this.config.lockfileFolder}/${constants.PNP_FILENAME}`);
    }
  }
}
