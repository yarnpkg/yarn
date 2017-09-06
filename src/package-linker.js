/* @flow */

import type {Manifest} from './types.js';
import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {HoistManifestTuples} from './package-hoister.js';
import type {CopyQueueItem} from './util/fs.js';
import type {InstallArtifacts} from './package-install-scripts.js';
import PackageHoister from './package-hoister.js';
import * as constants from './constants.js';
import * as promise from './util/promise.js';
import {entries} from './util/misc.js';
import * as fs from './util/fs.js';
import lockMutex from './util/mutex.js';
import {satisfiesWithPreleases} from './util/semver.js';
import WorkspaceLayout from './workspace-layout.js';

const invariant = require('invariant');
const cmdShim = promise.promisify(require('cmd-shim'));
const path = require('path');
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
      await cmdShim(src, dest);
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
  }

  artifacts: InstallArtifacts;
  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;
  topLevelBinLinking: boolean;

  setArtifacts(artifacts: InstallArtifacts) {
    this.artifacts = artifacts;
  }

  setTopLevelBinLinking(topLevelBinLinking: boolean) {
    this.topLevelBinLinking = topLevelBinLinking;
  }

  async linkSelfDependencies(pkg: Manifest, pkgLoc: string, targetBinLoc: string): Promise<void> {
    targetBinLoc = path.join(targetBinLoc, '.bin');
    await fs.mkdirp(targetBinLoc);
    targetBinLoc = await fs.realpath(targetBinLoc);
    pkgLoc = await fs.realpath(pkgLoc);
    for (const [scriptName, scriptCmd] of entries(pkg.bin)) {
      const dest = path.join(targetBinLoc, scriptName);
      const src = path.join(pkgLoc, scriptCmd);
      if (!await fs.exists(src)) {
        // TODO maybe throw an error
        continue;
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
        // Missing location means not installed inside node_modules
        dep._reference &&
        dep._reference.location &&
        dep.bin &&
        Object.keys(dep.bin).length
      ) {
        deps.push({
          dep,
          loc: this.config.generateHardModulePath(dep._reference),
        });
      }
    }

    // link up the `bin` scripts in bundled dependencies
    if (pkg.bundleDependencies) {
      for (const depName of pkg.bundleDependencies) {
        const loc = path.join(this.config.generateHardModulePath(ref), this.config.getFolder(pkg), depName);
        try {
          const dep = await this.config.readManifest(loc, remote.registry);

          if (dep.bin && Object.keys(dep.bin).length) {
            deps.push({dep, loc});
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
      if (dep._reference && dep._reference.location) {
        await this.linkSelfDependencies(dep, loc, dir);
      }
    }
  }

  getFlatHoistedTree(patterns: Array<string>, {ignoreOptional}: {ignoreOptional: ?boolean} = {}): HoistManifestTuples {
    const hoister = new PackageHoister(this.config, this.resolver, {ignoreOptional});
    hoister.seed(patterns);
    return hoister.init();
  }

  async copyModules(
    patterns: Array<string>,
    workspaceLayout?: WorkspaceLayout,
    {linkDuplicates, ignoreOptional}: {linkDuplicates: ?boolean, ignoreOptional: ?boolean} = {},
  ): Promise<void> {
    let flatTree = this.getFlatHoistedTree(patterns, {ignoreOptional});
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
    const linkTypeDepsLocations: Array<string> = [];
    for (const [folder, {pkg, loc}] of flatTree) {
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
        // store the dest location for later usage
        linkTypeDepsLocations.push(dest);
      } else if (workspaceLayout && remote.type === 'workspace') {
        src = remote.reference;
        type = 'symlink';
        if (dest.indexOf(workspaceLayout.virtualManifestName) !== -1) {
          // we don't need to install virtual manifest
          continue;
        }
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

      ref.setLocation(dest);

      const integrityArtifacts = this.artifacts[`${pkg.name}@${pkg.version}`];
      if (integrityArtifacts) {
        for (const file of integrityArtifacts) {
          artifactFiles.push(path.join(dest, file));
        }
      }

      const copiedDest = copiedSrcs.get(src);
      if (!copiedDest) {
        if (hardlinksEnabled) {
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

    // keep track of all scoped paths to remove empty scopes after copy
    const scopedPaths = new Set();

    // register root & scoped packages as being possibly extraneous
    const possibleExtraneous: Set<string> = new Set();
    for (const folder of this.config.registryFolders) {
      const loc = path.join(this.config.cwd, folder);

      if (await fs.exists(loc)) {
        const files = await fs.readdir(loc);
        let filepath;
        for (const file of files) {
          filepath = path.join(loc, file);
          if (file[0] === '@') {
            // it's a scope, not a package
            scopedPaths.add(filepath);
            const subfiles = await fs.readdir(filepath);
            for (const subfile of subfiles) {
              possibleExtraneous.add(path.join(filepath, subfile));
            }
          } else {
            possibleExtraneous.add(filepath);
          }
        }
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
        const packageName = entry;
        linkTargets.set(packageName, await fs.readlink(entryPath));
      } else if (stat.isDirectory() && entry[0] === '@') {
        // if the entry is directory beginning with '@', then we're dealing with a package scope, which
        // means we must iterate inside to retrieve the package names it contains
        const scopeName = entry;

        for (const entry2 of await fs.readdir(entryPath)) {
          const entryPath2 = path.join(entryPath, entry2);
          const stat2 = await fs.lstat(entryPath2);

          if (stat2.isSymbolicLink()) {
            const packageName = `${scopeName}/${entry2}`;
            linkTargets.set(packageName, await fs.readlink(entryPath2));
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
        linkTargets.get(packageName) === (await fs.readlink(loc))
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

      ignoreBasenames: [constants.METADATA_FILENAME, constants.TARBALL_FILENAME],

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
    if (this.config.binLinks) {
      const topLevelDependencies = this.determineTopLevelBinLinks(flatTree);
      const tickBin = this.reporter.progress(flatTree.length + topLevelDependencies.length);

      // create links in transient dependencies
      await promise.queue(
        flatTree,
        async ([dest, {pkg}]) => {
          if (pkg._reference && pkg._reference.location) {
            if (
              this._isChildOfLinkedDep(linkTypeDepsLocations, pkg._reference.location) ||
              this._isChildOfLinkedDep(linkTypeDepsLocations, dest)
            ) {
              tickBin();
              return;
            }
            const binLoc = path.join(dest, this.config.getFolder(pkg));
            await this.linkBinDependencies(pkg, binLoc);
            tickBin();
          }
        },
        linkBinConcurrency,
      );

      // create links at top level for all dependencies.
      await promise.queue(
        topLevelDependencies,
        async ([dest, pkg]) => {
          if (pkg._reference && pkg._reference.location && pkg.bin && Object.keys(pkg.bin).length) {
            if (
              this._isChildOfLinkedDep(linkTypeDepsLocations, pkg._reference.location) ||
              this._isChildOfLinkedDep(linkTypeDepsLocations, dest)
            ) {
              tickBin();
              return;
            }
            const binLoc = path.join(this.config.cwd, this.config.getFolder(pkg));
            await this.linkSelfDependencies(pkg, dest, binLoc);
            tickBin();
          }
        },
        linkBinConcurrency,
      );
    }

    for (const [, {pkg}] of flatTree) {
      await this._warnForMissingBundledDependencies(pkg);
    }
  }

  determineTopLevelBinLinks(flatTree: HoistManifestTuples): Array<[string, Manifest]> {
    const linksToCreate = new Map();
    for (const [dest, {pkg, isDirectRequire}] of flatTree) {
      const {name} = pkg;

      if (isDirectRequire || (this.topLevelBinLinking && !linksToCreate.has(name))) {
        linksToCreate.set(name, [dest, pkg]);
      }
    }

    return Array.from(linksToCreate.values());
  }

  resolvePeerModules() {
    for (const pkg of this.resolver.getManifests()) {
      const peerDeps = pkg.peerDependencies;
      if (!peerDeps) {
        continue;
      }
      const ref = pkg._reference;
      invariant(ref, 'Package reference is missing');

      for (const peerDepName in peerDeps) {
        const range = peerDeps[peerDepName];
        const peerPkgs = this.resolver.getAllInfoForPackageName(peerDepName);

        let peerError = 'unmetPeer';
        let resolvedLevelDistance = Infinity;
        let resolvedPeerPkgPattern;
        for (const peerPkg of peerPkgs) {
          const peerPkgRef = peerPkg._reference;
          if (!(peerPkgRef && peerPkgRef.patterns)) {
            continue;
          }
          const levelDistance = ref.level - peerPkgRef.level;
          if (levelDistance >= 0 && levelDistance < resolvedLevelDistance) {
            if (this._satisfiesPeerDependency(range, peerPkgRef.version)) {
              resolvedLevelDistance = levelDistance;
              resolvedPeerPkgPattern = peerPkgRef.patterns;
              this.reporter.verbose(
                this.reporter.lang(
                  'selectedPeer',
                  `${pkg.name}@${pkg.version}`,
                  `${peerDepName}@${range}`,
                  peerPkgRef.level,
                ),
              );
            } else {
              peerError = 'incorrectPeer';
            }
          }
        }

        if (resolvedPeerPkgPattern) {
          ref.addDependencies(resolvedPeerPkgPattern);
        } else {
          this.reporter.warn(this.reporter.lang(peerError, `${pkg.name}@${pkg.version}`, `${peerDepName}@${range}`));
        }
      }
    }
  }

  _satisfiesPeerDependency(range: string, version: string): boolean {
    return range === '*' || satisfiesWithPreleases(version, range, this.config.looseSemver);
  }

  _isChildOfLinkedDep(linkedDepLocations: Array<string>, location: string): boolean {
    let isWithinLink = false;
    linkedDepLocations.forEach(loc => {
      if (path.join(location, 'node_modules').startsWith(loc)) {
        isWithinLink = true;
      }
    });
    return isWithinLink;
  }

  async _warnForMissingBundledDependencies(pkg: Manifest): Promise<void> {
    const ref = pkg._reference;

    if (pkg.bundleDependencies) {
      for (const depName of pkg.bundleDependencies) {
        const loc = path.join(this.config.generateHardModulePath(ref), this.config.getFolder(pkg), depName);
        if (!await fs.exists(loc)) {
          const pkgHuman = `${pkg.name}@${pkg.version}`;
          this.reporter.warn(this.reporter.lang('missingBundledDependency', pkgHuman, depName));
        }
      }
    }
  }

  async init(
    patterns: Array<string>,
    workspaceLayout?: WorkspaceLayout,
    {linkDuplicates, ignoreOptional}: {linkDuplicates: ?boolean, ignoreOptional: ?boolean} = {},
  ): Promise<void> {
    this.resolvePeerModules();
    await this.copyModules(patterns, workspaceLayout, {linkDuplicates, ignoreOptional});
  }
}
