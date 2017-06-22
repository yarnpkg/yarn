/* @flow */

import type {Manifest, DependencyRequestPatterns, DependencyRequestPattern} from './types.js';
import type {RegistryNames} from './registries/index.js';
import type PackageReference from './package-reference.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import PackageRequest from './package-request.js';
import RequestManager from './util/request-manager.js';
import BlockingQueue from './util/blocking-queue.js';
import Lockfile from './lockfile/wrapper.js';
import map from './util/map.js';
import WorkspaceLayout from './workspace-layout.js';

const invariant = require('invariant');
const semver = require('semver');

export type ResolverOptions = {|
  isFlat?: boolean,
  isFrozen?: boolean,
  workspaceLayout?: WorkspaceLayout,
|};

export default class PackageResolver {
  constructor(config: Config, lockfile: Lockfile) {
    this.patternsByPackage = map();
    this.fetchingPatterns = map();
    this.fetchingQueue = new BlockingQueue('resolver fetching');
    this.patterns = map();
    this.usedRegistries = new Set();
    this.flat = false;

    this.reporter = config.reporter;
    this.lockfile = lockfile;
    this.config = config;
    this.delayedResolveQueue = [];
  }

  // whether the dependency graph will be flattened
  flat: boolean;

  frozen: boolean;

  workspaceLayout: ?WorkspaceLayout;

  // list of registries that have been used in this resolution
  usedRegistries: Set<RegistryNames>;

  // activity monitor
  activity: ?{
    tick: (name: string) => void,
    end: () => void,
  };

  // patterns we've already resolved or are in the process of resolving
  fetchingPatterns: {
    [key: string]: true,
  };

  // TODO
  fetchingQueue: BlockingQueue;

  // manages and throttles json api http requests
  requestManager: RequestManager;

  // list of patterns associated with a package
  patternsByPackage: {
    [packageName: string]: Array<string>,
  };

  // lockfile instance which we can use to retrieve version info
  lockfile: Lockfile;

  // a map of dependency patterns to packages
  patterns: {
    [packagePattern: string]: Manifest,
  };

  // reporter instance, abstracts out display logic
  reporter: Reporter;

  // environment specific config methods and options
  config: Config;

  // list of packages need to be resolved later (they found a matching version in the
  // resolver, but better matches can still arrive later in the resolve process)
  delayedResolveQueue: Array<{req: PackageRequest, info: Manifest}>;

  /**
   * TODO description
   */

  isNewPattern(pattern: string): boolean {
    return !!this.patterns[pattern].fresh;
  }

  updateManifest(ref: PackageReference, newPkg: Manifest): Promise<void> {
    // inherit fields
    const oldPkg = this.patterns[ref.patterns[0]];
    newPkg._reference = ref;
    newPkg._remote = ref.remote;
    newPkg.name = oldPkg.name;
    newPkg.fresh = oldPkg.fresh;

    // update patterns
    for (const pattern of ref.patterns) {
      this.patterns[pattern] = newPkg;
    }

    return Promise.resolve();
  }

  updateManifests(newPkgs: Array<Manifest>): Promise<void> {
    for (const newPkg of newPkgs) {
      if (newPkg._reference) {
        for (const pattern of newPkg._reference.patterns) {
          this.patterns[pattern] = newPkg;
        }
      }
    }

    return Promise.resolve();
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
   * Get a list of all manifests by topological order.
   */

  getTopologicalManifests(seedPatterns: Array<string>): Iterable<Manifest> {
    const pkgs: Set<Manifest> = new Set();
    const skip: Set<Manifest> = new Set();

    const add = (seedPatterns: Array<string>) => {
      for (const pattern of seedPatterns) {
        const pkg = this.getStrictResolvedPattern(pattern);
        if (skip.has(pkg)) {
          continue;
        }

        const ref = pkg._reference;
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
   * Get a list of all manifests by level sort order.
   */

  getLevelOrderManifests(seedPatterns: Array<string>): Iterable<Manifest> {
    const pkgs: Set<Manifest> = new Set();
    const skip: Set<Manifest> = new Set();

    const add = (seedPatterns: Array<string>) => {
      const refs = [];

      for (const pattern of seedPatterns) {
        const pkg = this.getStrictResolvedPattern(pattern);
        if (skip.has(pkg)) {
          continue;
        }

        const ref = pkg._reference;
        invariant(ref, 'expected reference');

        refs.push(ref);
        skip.add(pkg);
        pkgs.add(pkg);
      }

      for (const ref of refs) {
        add(ref.dependencies);
      }
    };

    add(seedPatterns);

    return pkgs;
  }

  /**
   * Get a list of all package names in the depenency graph.
   */

  getAllDependencyNamesByLevelOrder(seedPatterns: Array<string>): Iterable<string> {
    const names = new Set();
    for (const {name} of this.getLevelOrderManifests(seedPatterns)) {
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
   * replace pattern in resolver, e.g. `name` is replaced with `name@^1.0.1`
   */
  replacePattern(pattern: string, newPattern: string) {
    const pkg = this.getResolvedPattern(pattern);
    invariant(pkg, `missing package ${pattern}`);
    const ref = pkg._reference;
    invariant(ref, 'expected package reference');
    ref.patterns = [newPattern];
    this.addPattern(newPattern, pkg);
    this.removePattern(pattern);
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

    for (const pattern of patterns) {
      // don't touch the pattern we're collapsing to
      if (pattern === collapseToPattern) {
        continue;
      }

      // remove this pattern
      const ref = this.getStrictResolvedPattern(pattern)._reference;
      invariant(ref, 'expected package reference');
      const refPatterns = ref.patterns.slice();
      ref.prune();

      // add pattern to the manifest we're collapsing to
      for (const pattern of refPatterns) {
        collapseToReference.addPattern(pattern, collapseToManifest);
      }
    }

    return collapseToPattern;
  }

  /**
   * TODO description
   */

  addPattern(pattern: string, info: Manifest) {
    this.patterns[pattern] = info;

    const byName = (this.patternsByPackage[info.name] = this.patternsByPackage[info.name] || []);
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
   * Get the manifest of the highest known version that satisfies a package range
   */

  getHighestRangeVersionMatch(name: string, range: string): ?Manifest {
    const patterns = this.patternsByPackage[name];
    if (!patterns) {
      return null;
    }

    const versionNumbers = [];
    const resolvedPatterns = patterns.map((pattern): Manifest => {
      const info = this.getStrictResolvedPattern(pattern);
      versionNumbers.push(info.version);

      return info;
    });

    const maxValidRange = semver.maxSatisfying(versionNumbers, range);
    if (!maxValidRange) {
      return null;
    }

    const indexOfmaxValidRange = versionNumbers.indexOf(maxValidRange);
    const maxValidRangeManifest = resolvedPatterns[indexOfmaxValidRange];

    return maxValidRangeManifest;
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

    const lockfileEntry = this.lockfile.getLocked(req.pattern);
    let fresh = false;
    if (lockfileEntry) {
      const {range, hasVersion} = PackageRequest.normalizePattern(req.pattern);
      // lockfileEntry is incorrect, remove it from lockfile cache and consider the pattern as new
      if (
        semver.validRange(range) &&
        semver.valid(lockfileEntry.version) &&
        !semver.satisfies(lockfileEntry.version, range) &&
        !PackageRequest.getExoticResolver(range) &&
        hasVersion
      ) {
        this.reporter.warn(this.reporter.lang('incorrectLockfileEntry', req.pattern));
        this.removePattern(req.pattern);
        this.lockfile.removePattern(req.pattern);
        fresh = true;
      }
    } else {
      fresh = true;
    }

    const request = new PackageRequest(req, this);
    await request.find({fresh, frozen: this.frozen});
  }

  /**
   * TODO description
   */

  async init(
    deps: DependencyRequestPatterns,
    {isFlat, isFrozen, workspaceLayout}: ResolverOptions = {isFlat: false, isFrozen: false, workspaceLayout: undefined},
  ): Promise<void> {
    this.flat = Boolean(isFlat);
    this.frozen = Boolean(isFrozen);
    this.workspaceLayout = workspaceLayout;
    const activity = (this.activity = this.reporter.activity());

    for (const req of deps) {
      await this.find(req);
    }

    // all required package versions have been discovered, so now packages that
    // resolved to existing versions can be resolved to their best available version
    this.resolvePackagesWithExistingVersions();

    activity.end();
    this.activity = null;
  }

  /**
    * Called by the package requester for packages that this resolver already had
    * a matching version for. Delay the resolve, because better matches can still be
    * discovered.
    */

  reportPackageWithExistingVersion(req: PackageRequest, info: Manifest) {
    this.delayedResolveQueue.push({req, info});
  }

  /**
    * Executes the resolve to existing versions for packages after the find process,
    * when all versions that are going to be used have been discovered.
    */

  resolvePackagesWithExistingVersions() {
    for (const {req, info} of this.delayedResolveQueue) {
      req.resolveToExistingVersion(info);
    }
  }
}
