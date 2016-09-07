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

import type {Manifest, DependencyRequestPatterns, DependencyRequestPattern} from './types.js';
import type {RegistryNames} from './registries/index.js';
import type PackageReference from './package-reference.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import {REMOVED_ANCESTOR} from './package-reference.js';
import PackageRequest from './package-request.js';
import RequestManager from './util/request-manager.js';
import BlockingQueue from './util/blocking-queue.js';
import Lockfile from './lockfile/wrapper.js';
import map from './util/map.js';

const invariant = require('invariant');

export default class PackageResolver {
  constructor(config: Config, lockfile: Lockfile) {
    this.patternsByPackage = map();
    this.fetchingPatterns = map();
    this.fetchingQueue = new BlockingQueue('resolver fetching');
    this.newPatterns = [];
    this.patterns = map();
    this.usedRegistries = new Set();
    this.flat = false;

    this.reporter = config.reporter;
    this.lockfile = lockfile;
    this.config = config;
  }

  // whether the dependency graph will be flattened
  flat: boolean;

  // list of registries that have been used in this resolution
  usedRegistries: Set<RegistryNames>;

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

  // these are patterns that the package resolver was seeded with. these are required in
  // order to resolve top level peerDependencies
  seedPatterns: Array<string>;

  // manages and throttles json api http requests
  requestManager: RequestManager;

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
    const oldPkg = this.patterns[ref.patterns[0]];
    newPkg._reference = ref;
    newPkg._remote = oldPkg._remote;
    newPkg.name = oldPkg.name;

    // update patterns
    for (const pattern of ref.patterns) {
      this.patterns[pattern] = newPkg;
    }
  }

  /**
   * Given a list of patterns, dedupe them to a list of unique patterns.
   */

  dedupePatterns(patterns: Iterable<string>): Array<string> {
    const deduped = [];
    const seen = new Set();

    for (const pattern of patterns) {
      const info = this.getResolvedPattern(pattern);
      if (seen.has(info)) {
        continue;
      }

      seen.add(info);
      deduped.push(pattern);
    }

    return deduped;
  }

  /**
   * Description
   */

  getTopologicalManifests(seedPatterns: Array<string>): Iterable<Manifest> {
    let pkgs: Set<Manifest> = new Set();
    let skip: Set<Manifest> = new Set();

    let add = (seedPatterns: Array<string>) => {
      for (let pattern of seedPatterns) {
        let pkg = this.getStrictResolvedPattern(pattern);
        if (skip.has(pkg)) {
          continue;
        }

        let ref = pkg._reference;
        invariant(ref, 'expected reference');
        skip.add(pkg);
        add(ref.dependencies);
        pkgs.add(pkg);
      }
    };

    add(seedPatterns);

    return pkgs;
  }

  /**
   * Get a list of all package names in the depenency graph.
   */

  getAllDependencyNames(seedPatterns: Array<string>): Iterable<string> {
    let names = new Set();
    for (let {name} of this.getTopologicalManifests(seedPatterns)) {
      names.add(name);
    }
    return names;
  }

  /**
   * Retrieve all the package info stored for this package name.
   */

  getAllInfoForPackageName(name: string): Array<Manifest> {
    const infos = [];
    const seen = new Set();

    for (const pattern of this.patternsByPackage[name]) {
      const info = this.patterns[pattern];
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
    let refs = [];

    for (const pattern in this.patterns) {
      let manifest = this.patterns[pattern];
      let ref = manifest._reference;
      if (ref) {
        refs.push(ref);
      }
    }

    return refs;
  }

  /**
   * Get a flat list of all package info.
   */

  getManifests(): Array<Manifest> {
    const infos = [];
    const seen = new Set();

    for (const pattern in this.patterns) {
      const info = this.patterns[pattern];
      if (seen.has(info)) {
        continue;
      }

      infos.push(info);
      seen.add(info);
    }

    return infos;
  }

  /**
   * Make all versions of this package resolve to it.
   */

  collapseAllVersionsOfPackage(name: string, version: string): string {
    const patterns = this.dedupePatterns(this.patternsByPackage[name]);
    const human = `${name}@${version}`;

    // get manifest that matches the version we're collapsing too
    let collapseToReference: ?PackageReference;
    let collapseToManifest: Manifest;
    let collapseToPattern: string;
    for (const pattern of patterns) {
      const _manifest = this.patterns[pattern];
      if (_manifest.version === version) {
        collapseToReference = _manifest._reference;
        collapseToManifest = _manifest;
        collapseToPattern = pattern;
        break;
      }
    }
    invariant(
      collapseToReference && collapseToManifest && collapseToPattern,
      `Couldn't find package manifest for ${human}`,
    );

    for (let pattern of patterns) {
      // don't touch the pattern we're collapsing to
      if (pattern === collapseToPattern) {
        continue;
      }

      // remove this pattern
      let ref = this.getStrictResolvedPattern(pattern)._reference;
      invariant(ref, 'expected package reference');
      ref.addVisibility(REMOVED_ANCESTOR);
      ref.prune();

      for (let action in ref.visibility) {
        collapseToReference.visibility[action] += ref.visibility[action];
      }

      // add pattern to the manifest we're collapsing to
      collapseToReference.addPattern(pattern, collapseToManifest);
    }

    return collapseToPattern;
  }

  /**
   * TODO description
   */

  addPattern(pattern: string, info: Manifest) {
    this.patterns[pattern] = info;

    const byName = this.patternsByPackage[info.name] = this.patternsByPackage[info.name] || [];
    byName.push(pattern);
  }

  /**
   * TODO description
   */

  removePattern(pattern: string) {
    const pkg = this.patterns[pattern];
    if (!pkg) {
      return;
    }

    const byName = this.patternsByPackage[pkg.name];
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
    const manifest = this.getResolvedPattern(pattern);
    invariant(manifest, 'expected manifest');
    return manifest;
  }

  /**
   * TODO description
   */

  getExactVersionMatch(name: string, version: string): ?Manifest {
    const patterns = this.patternsByPackage[name];
    if (!patterns) {
      return null;
    }

    for (const pattern of patterns) {
      const info = this.getStrictResolvedPattern(pattern);
      if (info.version === version) {
        return info;
      }
    }

    return null;
  }

  /**
   * TODO description
   */

  async find(req: DependencyRequestPattern): Promise<void> {
    const fetchKey = `${req.registry}:${req.pattern}`;
    if (this.fetchingPatterns[fetchKey]) {
      return;
    } else {
      this.fetchingPatterns[fetchKey] = true;
    }

    if (this.activity) {
      this.activity.tick(req.pattern);
    }

    if (!this.lockfile.getLocked(req.pattern, true)) {
      this.newPatterns.push(req.pattern);
    }

    // propagate `visibility` option
    let {parentRequest} = req;
    if (parentRequest && parentRequest.visibility) {
      req.visibility = parentRequest.visibility;
    }

    const request = new PackageRequest(req, this);
    await request.find();
  }

  /**
   * TODO description
   */

  async init(deps: DependencyRequestPatterns, isFlat: boolean): Promise<void> {
    this.flat = isFlat;

    //
    const activity = this.activity = this.reporter.activity();

    //
    this.seedPatterns = deps.map((dep): string => dep.pattern);

    // build up promises
    const promises = [];
    for (let req of deps) {
      promises.push(this.find(req));
    }
    await Promise.all(promises);

    activity.end();
    this.activity = null;

    this.config.requestManager.clearCache();
  }
}
