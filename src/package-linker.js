/* @flow */

import type {Manifest} from './types.js';
import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {HoistManifestTuples} from './package-hoister.js';
import type {CopyQueueItem} from './util/fs.js';
import PackageHoister from './package-hoister.js';
import * as constants from './constants.js';
import * as promise from './util/promise.js';
import {entries} from './util/misc.js';
import * as fs from './util/fs.js';

const invariant = require('invariant');
const cmdShim = promise.promisify(require('cmd-shim'));
const semver = require('semver');
const path = require('path');

type DependencyPair = {
  dep: Manifest,
  loc: string
};

type DependencyPairs = Array<DependencyPair>;

export async function linkBin(src: string, dest: string): Promise<void> {
  if (process.platform === 'win32') {
    await cmdShim(src, dest);
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
  }

  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;

  // make linkBin testable by inserting the function into PackageLinker
  async linkBin(src: string, dest: string): Promise<void> {
    await linkBin(src, dest);
  }

  async linkSelfDependencies(pkg: Manifest, pkgLoc: string, targetBinLoc: string): Promise<void> {
    targetBinLoc = await fs.realpath(targetBinLoc);
    pkgLoc = await fs.realpath(pkgLoc);
    for (const [scriptName, scriptCmd] of entries(pkg.bin)) {
      const dest = path.join(targetBinLoc, scriptName);
      const src = path.join(pkgLoc, scriptCmd);
      if (!await fs.exists(src)) {
        // TODO maybe throw an error
        continue;
      }
      await this.linkBin(src, dest);
    }
  }

  async getBinDependencies(pkg: Manifest): Promise<DependencyPairs> {
    const deps: DependencyPairs = [];

    const ref = pkg._reference;
    invariant(ref, 'Package reference is missing');

    const remote = pkg._remote;
    invariant(remote, 'Package remote is missing');

    // link up `bin scripts` in `dependencies`
    for (const pattern of ref.dependencies) {
      const dep = this.resolver.getStrictResolvedPattern(pattern);
      if (dep.bin && Object.keys(dep.bin).length) {
        deps.push({dep, loc: this.config.generateHardModulePath(dep._reference)});
      }
    }

    // link up the `bin` scripts in bundled dependencies
    if (pkg.bundleDependencies) {
      for (const depName of pkg.bundleDependencies) {
        const loc = path.join(
          this.config.generateHardModulePath(ref),
          this.config.getFolder(pkg),
          depName,
        );

        const dep = await this.config.readManifest(loc, remote.registry);

        if (dep.bin && Object.keys(dep.bin).length) {
          deps.push({dep, loc});
        }
      }
    }

    return deps;
  }

  async linkDependencies(flatTree: HoistManifestTuples): Promise<void> {
    // Create a map of .bin location to a map of bin command and its
    // source location. we remove all duplicates for each .bin location,
    // this will prevents multiple calls to create the same symlink.
    const binsByLocation: Map<string, Map<string, Manifest>> = new Map();
    async function getBinLinks(binLoc: string): Promise<Map<string, Manifest>> {
      if (!binsByLocation.has(binLoc)) {
        // ensure our .bin file we're writing these to exists
        await fs.mkdirp(binLoc);
        binsByLocation.set(binLoc, new Map());
      }
      const binLinks = binsByLocation.get(binLoc);
      invariant(binLinks, 'expected value');
      return binLinks;
    }

    let binsCount = 0;
    for (const [dest, {pkg}] of flatTree) {
      const modules = this.config.getFolder(pkg);
      const rootLoc = path.join(this.config.cwd, modules);
      const pkgLoc = path.dirname(dest);
      const parentBinLoc = path.join(pkgLoc, '.bin');
      const pkgBinLoc = path.join(dest, modules, '.bin');

      const deps = await this.getBinDependencies(pkg);

      for (const {dep, loc} of deps) {
        // replace dependency location that point to different package,
        // if the one in the current location is identical
        let newDepLoc;
        const depLoc = path.dirname(loc);
        if (depLoc !== pkgLoc && depLoc !== rootLoc && path.dirname(depLoc) !== dest) {
          newDepLoc = path.join(dest, modules, dep.name);
          const manifest = await this.config.maybeReadManifest(newDepLoc);
          if (!manifest || manifest.version !== dep.version) {
            newDepLoc = null;
          }
        }

        // When both package and dependency are in the same folder use the .bin
        // in that folder, else use the .bin in the package.
        const location = newDepLoc || loc;
        const binLoc = path.dirname(location) === pkgLoc ? parentBinLoc : pkgBinLoc;
        const binLinks = await getBinLinks(binLoc);
        // Remove Duplicates
        if (!binLinks.has(location)) {
          binLinks.set(location, dep);
          binsCount++;
        }
      }
    }

    // write the executables
    const tickBin = this.reporter.progress(binsCount);
    for (const [binLoc, binLinks] of binsByLocation) {
      for (const [loc, dep] of binLinks) {
        await this.linkSelfDependencies(dep, loc, binLoc);
        tickBin(loc);
      }
    }
  }

  getFlatHoistedTree(patterns: Array<string>): Promise<HoistManifestTuples> {
    const hoister = new PackageHoister(this.config, this.resolver);
    hoister.seed(patterns);
    return Promise.resolve(hoister.init());
  }

  async copyModules(patterns: Array<string>): Promise<void> {
    let flatTree = await this.getFlatHoistedTree(patterns);

    // sorted tree makes file creation and copying not to interfere with each other
    flatTree = flatTree.sort(function(dep1, dep2): number {
      return dep1[0].localeCompare(dep2[0]);
    });

    // list of artifacts in modules to remove from extraneous removal
    const phantomFiles = [];

    //
    const queue: Map<string, CopyQueueItem> = new Map();
    for (const [dest, {pkg, loc: src}] of flatTree) {
      const ref = pkg._reference;
      invariant(ref, 'expected package reference');
      ref.setLocation(dest);

      // get a list of build artifacts contained in this module so we can prevent them from being marked as
      // extraneous
      const metadata = await this.config.readPackageMetadata(src);
      for (const file of metadata.artifacts) {
        phantomFiles.push(path.join(dest, file));
      }

      queue.set(dest, {
        src,
        dest,
        onFresh() {
          if (ref) {
            ref.setFresh(true);
          }
        },
      });
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
          if (file[0] === '@') { // it's a scope, not a package
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
        queue.delete(loc);
      }
    }

    //
    let tick;
    await fs.copyBulk(Array.from(queue.values()), this.reporter, {
      possibleExtraneous,
      phantomFiles,

      ignoreBasenames: [
        constants.METADATA_FILENAME,
        constants.TARBALL_FILENAME,
      ],

      onStart: (num: number) => {
        tick = this.reporter.progress(num);
      },

      onProgress(src: string) {
        if (tick) {
          tick(src);
        }
      },
    });

    // remove any empty scoped directories
    for (const scopedPath of scopedPaths) {
      const files = await fs.readdir(scopedPath);
      if (files.length === 0) {
        await fs.unlink(scopedPath);
      }
    }

    //
    if (this.config.binLinks) {
      await this.linkDependencies(flatTree);
    }
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

      // find a dependency in the tree above us that matches
      let searchPatterns: Array<string> = [];
      for (let request of ref.requests) {
        do {
          // get resolved pattern for this request
          const dep = this.resolver.getResolvedPattern(request.pattern);
          if (!dep) {
            continue;
          }

          //
          const ref = dep._reference;
          invariant(ref, 'expected reference');
          searchPatterns = searchPatterns.concat(ref.dependencies);
        } while (request = request.parentRequest);
      }

      // include root seed patterns last
      searchPatterns = searchPatterns.concat(this.resolver.seedPatterns);

      // find matching dep in search patterns
      let foundDep: ?{pattern: string, version: string};
      for (const pattern of searchPatterns) {
        const dep = this.resolver.getResolvedPattern(pattern);
        if (dep && dep.name === name) {
          foundDep = {pattern, version: dep.version};
          break;
        }
      }

      // validate found peer dependency
      if (foundDep && this._satisfiesPeerDependency(range, foundDep.version)) {
        ref.addDependencies([foundDep.pattern]);
      } else {
        const depError = foundDep ? 'incorrectPeer' : 'unmetPeer';
        const [pkgHuman, depHuman] = [`${pkg.name}@${pkg.version}`, `${name}@${range}`];
        this.reporter.warn(this.reporter.lang(depError, pkgHuman, depHuman));
      }
    }
  }

  _satisfiesPeerDependency(range: string, version: string): boolean {
    return range === '*' || semver.satisfies(version, range, this.config.looseSemver);
  }

  async init(patterns: Array<string>): Promise<void> {
    this.resolvePeerModules();
    await this.copyModules(patterns);
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
    if (this.config.binLinks && resolved.bin && Object.keys(resolved.bin).length) {
      const folder = this.config.modulesFolder || path.join(this.config.cwd, this.config.getFolder(resolved));
      const binLoc = path.join(folder, '.bin');
      await fs.mkdirp(binLoc);
      await this.linkSelfDependencies(resolved, src, binLoc);
    }
  }

  async saveAll(deps: Array<string>): Promise<void> {
    deps = this.resolver.dedupePatterns(deps);
    await promise.queue(deps, (dep): Promise<void> => this.save(dep));
  }
}
