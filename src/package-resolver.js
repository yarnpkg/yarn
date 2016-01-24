/* @flow */

import type { PackageInfo } from "./types";
import type { PackageRegistry } from "./resolvers";
import type PackageReference from "./package-reference";
import type Reporter from "./reporters/_base";
import type Config from "./config";
import normalisePackageInfo from "./util/normalise-package-info";
import PackageRequest from "./package-request";
import RequestManager from "./util/request-manager";
import Lockfile from "./lockfile";

let invariant = require("invariant");

export default class PackageResolver {
  constructor(config: Config, reporter: Reporter, lockfile: Lockfile) {
    this.packageReferencesByName = Object.create(null);
    this.patternsByPackage       = Object.create(null);
    this.newPatterns             = [];
    this.fetchingPatterns        = Object.create(null);
    this.patterns                = Object.create(null);

    this.reporter = reporter;
    this.config   = config;

    this.requestManager = new RequestManager(reporter);
    this.lockfile     = lockfile;
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
    [packagePattern: string]: PackageInfo
  };

  // reporter instance, abstracts out display logic
  reporter: Reporter;

  // environment specific config methods and options
  config: Config;

  /**
   * TODO description
   */

  async updatePackageInfo(ref: PackageReference, newPkg: PackageInfo): Promise<void> {
    newPkg = await normalisePackageInfo(newPkg, this.config.generateHardModulePath(ref));

    // inherit fields
    let oldPkg = this.patterns[ref.patterns[0]];
    newPkg.reference = ref;
    newPkg.remote = oldPkg.remote;

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
     let seen = {};

     for (let pattern of patterns) {
       let info = this.getResolvedPattern(pattern);
       if (info._seen === seen) continue;

       info._seen = seen;
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

  getAllInfoForPackageName(name: string): Array<PackageInfo> {
    let infos = [];
    let seen  = {};

    for (let pattern of this.patternsByPackage[name]) {
      let info = this.patterns[pattern];
      if (info._seen === seen) continue;

      info._seen = seen;
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

  getPackageInfos(): Array<PackageInfo> {
    let infos = [];
    let seen  = {};

    for (let pattern in this.patterns) {
      let info = this.patterns[pattern];
      if (info._seen === seen) continue;

      infos.push(info);
      info._seen = seen;
    }

    return infos;
  }

  /**
   * TODO description
   */

   registerPackageReference(ref: ?PackageReference) {
     invariant(ref, "No package reference passed");
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
    let info: PackageInfo;
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

  addPattern(pattern: string, info: PackageInfo) {
    this.patterns[pattern] = info;

    let byName = this.patternsByPackage[info.name] = this.patternsByPackage[info.name] || [];
    byName.push(pattern);
  }

  /**
   * TODO description
   */

  getResolvedPattern(pattern: string): any {
    return this.patterns[pattern];
  }

  /**
   * TODO description
   */

  getExactVersionMatch(name: string, version: string): ?PackageInfo {
    let patterns = this.patternsByPackage[name];
    if (!patterns) return;

    for (let pattern of patterns) {
      let info = this.getResolvedPattern(pattern);
      if (info.version === version) {
        return info;
      }
    }
  }

  /**
   * TODO description
   */

  async find(
    pattern: string,
    registry: PackageRegistry,
    optional?: boolean = false,
    parentRequest?: ?PackageRequest
  ): Promise<void> {
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

    return new PackageRequest({
      pattern,
      registry,
      parentRequest,
      config: this.config,
      reporter: this.reporter,
      requestManager: this.requestManager,
      lockfile: this.lockfile,
      resolver: this
    }).find(optional);
  }

  /**
   * TODO description
   */

  async init(deps: Array<{
    pattern: string,
    registry: PackageRegistry,
    optional?: boolean
  }>): Promise<void> {
    let activity = this.activity = this.reporter.activity();

    // build up promises
    let promises = [];
    for (let { pattern, registry, optional } of deps) {
      promises.push(this.find(pattern, registry, optional));
    }
    await Promise.all(promises);

    activity.end();
    this.activity = null;

    this.requestManager.clearCache();
  }
}
