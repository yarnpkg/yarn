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

const invariant = require('invariant');
const cmdShim = promise.promisify(require('cmd-shim'));
const path = require('path');

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
  }

  artifacts: InstallArtifacts;
  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;

  setArtifacts(artifacts: InstallArtifacts) {
    this.artifacts = artifacts;
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
      if (dep.bin && Object.keys(dep.bin).length) {
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

        const dep = await this.config.readManifest(loc, remote.registry);

        if (dep.bin && Object.keys(dep.bin).length) {
          deps.push({dep, loc});
        }
      }
    }

    // no deps to link
    if (!deps.length) {
      return;
    }

    // write the executables
    for (const {dep, loc} of deps) {
      await this.linkSelfDependencies(dep, loc, dir);
    }
  }

  getFlatHoistedTree(patterns: Array<string>): Promise<HoistManifestTuples> {
    const hoister = new PackageHoister(this.config, this.resolver);
    hoister.seed(patterns);
    return Promise.resolve(hoister.init());
  }

  async copyModules(patterns: Array<string>, linkDuplicates: boolean): Promise<void> {
    let flatTree = await this.getFlatHoistedTree(patterns);

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
    for (const [dest, {pkg, loc: src}] of flatTree) {
      const ref = pkg._reference;
      invariant(ref, 'expected package reference');
      ref.setLocation(dest);

      // backwards compatibility: get build artifacts from metadata
      const metadata = await this.config.readPackageMetadata(src);
      for (const file of metadata.artifacts) {
        artifactFiles.push(path.join(dest, file));
      }

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

    // linked modules
    for (const loc of possibleExtraneous) {
      const stat = await fs.lstat(loc);
      if (stat.isSymbolicLink()) {
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
          tick(src);
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
          tick(src);
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
      const linksToCreate = this.determineTopLevelBinLinks(flatTree);
      const tickBin = this.reporter.progress(flatTree.length + linksToCreate.length);

      // create links in transient dependencies
      await promise.queue(
        flatTree,
        async ([dest, {pkg}]) => {
          const binLoc = path.join(dest, this.config.getFolder(pkg));
          await this.linkBinDependencies(pkg, binLoc);
          tickBin(dest);
        },
        4,
      );

      // create links at top level for all dependencies.
      // non-transient dependencies will overwrite these during this.save() to ensure they take priority.
      await promise.queue(
        linksToCreate,
        async ([dest, {pkg}]) => {
          if (pkg.bin && Object.keys(pkg.bin).length) {
            const binLoc = path.join(this.config.cwd, this.config.getFolder(pkg));
            await this.linkSelfDependencies(pkg, dest, binLoc);
            tickBin(this.config.cwd);
          }
        },
        4,
      );
    }
  }

  determineTopLevelBinLinks(flatTree: HoistManifestTuples): HoistManifestTuples {
    const linksToCreate = new Map();

    flatTree.forEach(([dest, hoistManifest]) => {
      if (!linksToCreate.has(hoistManifest.pkg.name)) {
        linksToCreate.set(hoistManifest.pkg.name, [dest, hoistManifest]);
      }
    });

    return Array.from(linksToCreate.values());
  }

  resolvePeerModules() {
    for (const pkg of this.resolver.getManifests()) {
      this._resolvePeerModules(pkg);
    }
  }

  _resolvePeerModules(pkg: Manifest) {
    const peerDeps = pkg.peerDependencies;
    if (!peerDeps) {
      return;
    }

    const ref = pkg._reference;
    invariant(ref, 'Package reference is missing');

    for (const name in peerDeps) {
      const range = peerDeps[name];
      const patterns = this.resolver.patternsByPackage[name] || [];
      const foundPattern = patterns.find(pattern => {
        const resolvedPattern = this.resolver.getResolvedPattern(pattern);
        return resolvedPattern ? this._satisfiesPeerDependency(range, resolvedPattern.version) : false;
      });

      if (foundPattern) {
        ref.addDependencies([foundPattern]);
      } else {
        const depError = patterns.length > 0 ? 'incorrectPeer' : 'unmetPeer';
        const [pkgHuman, depHuman] = [`${pkg.name}@${pkg.version}`, `${name}@${range}`];
        this.reporter.warn(this.reporter.lang(depError, pkgHuman, depHuman));
      }
    }
  }

  _satisfiesPeerDependency(range: string, version: string): boolean {
    return range === '*' || satisfiesWithPreleases(version, range, this.config.looseSemver);
  }

  async init(patterns: Array<string>, linkDuplicates: boolean): Promise<void> {
    this.resolvePeerModules();
    await this.copyModules(patterns, linkDuplicates);
    await this.saveAll(patterns);
  }

  async save(pattern: string): Promise<void> {
    const resolved = this.resolver.getResolvedPattern(pattern);
    invariant(resolved, `Couldn't find resolved name/version for ${pattern}`);

    const ref = resolved._reference;
    invariant(ref, 'Missing reference');

    //
    const src = this.config.generateHardModulePath(ref);

    // link bins
    if (this.config.binLinks && resolved.bin && Object.keys(resolved.bin).length && !ref.ignore) {
      const binLoc = this.config.modulesFolder || path.join(this.config.cwd, this.config.getFolder(resolved));
      await this.linkSelfDependencies(resolved, src, binLoc);
    }
  }

  async saveAll(deps: Array<string>): Promise<void> {
    deps = this.resolver.dedupePatterns(deps);
    await promise.queue(deps, (dep): Promise<void> => this.save(dep));
  }
}
