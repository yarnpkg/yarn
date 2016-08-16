/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type { Manifest, DependencyRequestPatterns } from './types.js';
import type { RegistryNames } from './registries/index.js';
import type PackageReference from './package-reference.js';
import type { Reporter } from './reporters/index.js';
import type Config from './config.js';
import PackageFetcher from './package-fetcher.js';
import PackageRequest from './package-request.js';
import RequestManager from './util/request-manager.js';
import BlockingQueue from './util/blocking-queue.js';
import Lockfile from './lockfile/index.js';
import map from './util/map.js';

let invariant = require('invariant');

export default class PackageResolver {
  constructor(config: Config, lockfile: Lockfile) {
    this.packageReferencesByName = map();
    this.patternsByPackage       = map();
    this.fetchingPatterns        = map();
    this.fetchingQueue           = new BlockingQueue('resolver fetching');
    this.newPatterns             = [];
    this.patterns                = map();

    this.fetcher  = new PackageFetcher(config, this);
    this.reporter = config.reporter;
    this.lockfile = lockfile;
    this.config   = config;
  }

  // activity monitor
  activity: ?{
    tick: (name: string) => void,
    end: () => void
  };

  // patterns we've already resolved or are in the process of resolving
  fetchingPatterns: {
    [key: string]: true
  };

  // new patterns that didn't exist in the lockfile
  newPatterns: Array<string>;

  // TODO
  fetchingQueue: BlockingQueue;

  // TODO
  fetcher: PackageFetcher;

  // these are patterns that the package resolver was seeded with. these are required in
  // order to resolve top level peerDependencies
  seedPatterns: Array<string>;

  // manages and throttles json api http requests
  requestManager: RequestManager;

  // flat list of all dependencies we've resolved
  packageReferencesByName: {
    [packageName: string]: Array<PackageReference>
  };

  // list of patterns associated with a package
  patternsByPackage: {
    [packageName: string]: Array<string>
  };

  // lockfile instance which we can use to retrieve version info
  lockfile: Lockfile;

  // a map of dependency patterns to packages
  patterns: {
    [packagePattern: string]: Manifest
  };

  // reporter instance, abstracts out display logic
  reporter: Reporter;

  // environment specific config methods and options
  config: Config;

  /**
   * TODO description
   */

  isNewPattern(pattern: string): boolean {
    return this.newPatterns.indexOf(pattern) >= 0;
  }

  /**
   * TODO description
   */

  async updateManifest(ref: PackageReference, newPkg: Manifest): Promise<void> {
    // inherit fields
    let oldPkg = this.patterns[ref.patterns[0]];
    newPkg.reference = ref;
    newPkg.remote = oldPkg.remote;
    newPkg.name = oldPkg.name;

    // update patterns
    for (let pattern of ref.patterns) {
      this.patterns[pattern] = newPkg;
    }
  }

  /**
   * Given a list of patterns, dedupe them to a list of unique patterns.
   */

  dedupePatterns(patterns: Array<string>): Array<string> {
    let deduped = [];
    let seen = new Set();

    for (let pattern of patterns) {
      let info = this.getResolvedPattern(pattern);
      if (seen.has(info)) {
        continue;
      }

      seen.add(info);
      deduped.push(pattern);
    }

    return deduped;
  }

  /**
   * Get a list of all package names in the depenency graph.
   */

  getAllDependencyNames(): Array<string> {
    return Object.keys(this.patternsByPackage);
  }

  /**
   * Retrieve all the package info stored for this package name.
   */

  getAllInfoForPackageName(name: string): Array<Manifest> {
    let infos = [];
    let seen  = new Set();

    for (let pattern of this.patternsByPackage[name]) {
      let info = this.patterns[pattern];
      if (seen.has(info)) {
        continue;
      }

      seen.add(info);
      infos.push(info);
    }

    return infos;
  }

  /**
   * Get a flat list of all package references.
   */

  getPackageReferences(): Array<PackageReference> {
    let packages = [];

    for (let name in this.packageReferencesByName) {
      packages = packages.concat(this.packageReferencesByName[name]);
    }

    return packages;
  }

  /**
   * Get a flat list of all package info.
   */

  getManifests(): Array<Manifest> {
    let infos = [];
    let seen  = new Set();

    for (let pattern in this.patterns) {
      let info = this.patterns[pattern];
      if (seen.has(info)) {
        continue;
      }

      infos.push(info);
      seen.add(info);
    }

    return infos;
  }

  /**
   * TODO description
   */

  registerPackageReference(ref: ?PackageReference) {
    invariant(ref, 'No package reference passed');
    let pkgs = this.packageReferencesByName[ref.name] = this.packageReferencesByName[ref.name] || [];
    pkgs.push(ref);
  }

  /**
   * Make all versions of this package resolve to it.
   */

  collapseAllVersionsOfPackage(name: string, version: string): string {
    let patterns = this.patternsByPackage[name];
    let human = `${name}@${version}`;

    // get package info
    let info: Manifest;
    for (let pattern of patterns) {
      let _info = this.patterns[pattern];
      if (_info.version === version) {
        info = _info;
        break;
      }
    }
    invariant(info, `Couldn't find package info for ${human}`);

    // get package ref
    let ref: PackageReference;
    for (let _ref of this.packageReferencesByName[name]) {
      if (_ref.version === version) {
        ref = _ref;
        break;
      }
    }
    invariant(ref, `Couldn't find package ref for ${human}`);

    // set the package reference to a single package
    this.packageReferencesByName[name] = [ref];

    // set patterns to reference our package info, return the last one
    let pattern;
    for (pattern of patterns) {
      this.patterns[pattern] = info;
    }
    invariant(pattern, `Couldn't find a single pattern for ${human}`);
    return pattern;
  }

  /**
   * TODO description
   */

  addPattern(pattern: string, info: Manifest) {
    this.patterns[pattern] = info;

    let byName = this.patternsByPackage[info.name] = this.patternsByPackage[info.name] || [];
    byName.push(pattern);
  }

  /**
   * TODO description
   */

  removePattern(pattern: string) {
    let pkg = this.patterns[pattern];
    if (!pkg) {
      return;
    }

    let byName = this.patternsByPackage[pkg.name];
    if (!byName) {
      return;
    }

    byName.splice(byName.indexOf(pattern), 1);
    delete this.patterns[pattern];
  }

  /**
   * TODO description
   */

  getResolvedPattern(pattern: string): ?Manifest {
    return this.patterns[pattern];
  }

  /**
   * TODO description
   */

  getStrictResolvedPattern(pattern: string): Manifest {
    let manifest = this.getResolvedPattern(pattern);
    invariant(manifest, 'expected manifest');
    return manifest;
  }

  /**
   * TODO description
   */

  getExactVersionMatch(name: string, version: string): ?Manifest {
    let patterns = this.patternsByPackage[name];
    if (!patterns) {
      return null;
    }

    for (let pattern of patterns) {
      let info = this.getStrictResolvedPattern(pattern);
      if (info.version === version) {
        return info;
      }
    }

    return null;
  }

  /**
   * TODO description
   */

  async find({
    pattern,
    registry,
    ignore = false,
    optional = false,
    parentRequest,
    subLockfile,
  }: {
    pattern: string,
    registry: RegistryNames,
    optional?: boolean,
    ignore?: boolean,
    parentRequest?: ?PackageRequest,
    subLockfile?: ?Lockfile
  }): Promise<void> {
    let fetchKey = `${registry}:${pattern}`;
    if (this.fetchingPatterns[fetchKey]) {
      return;
    } else {
      this.fetchingPatterns[fetchKey] = true;
    }

    if (this.activity) {
      this.activity.tick(pattern);
    }

    if (!this.lockfile.getLocked(pattern, true)) {
      this.newPatterns.push(pattern);
    }

    // propagate `ignore` option
    if (parentRequest && parentRequest.ignore) {
      ignore = true;
    }

    let request = new PackageRequest({
      lockfile: subLockfile,
      pattern,
      registry,
      parentRequest,
      optional,
      ignore,
      resolver: this,
    });
    await request.find();
  }

  /**
   * TODO description
   */

  async init(deps: DependencyRequestPatterns): Promise<void> {
    //
    let activity = this.activity = this.reporter.activity();

    //
    this.seedPatterns = deps.map((dep): string => dep.pattern);

    // build up promises
    let promises = [];
    for (let { pattern, registry, optional } of deps) {
      promises.push(this.find({ pattern, registry, optional }));
    }
    await Promise.all(promises);

    activity.end();
    this.activity = null;

    this.config.requestManager.clearCache();
  }
}
