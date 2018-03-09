/* @flow */

import type PackageResolver from './package-resolver.js';
import Config from './config.js';
import type {Manifest} from './types.js';
import {sortAlpha} from './util/misc.js';
import mm from 'micromatch';

const invariant = require('invariant');
const path = require('path');

type Parts = Array<string>;

let historyCounter = 0;

const LINK_TYPES = new Set(['workspace', 'link']);
type NewPartsType = {
  parts: Parts,
  duplicate: boolean,
};

export class HoistManifest {
  constructor(
    key: string,
    parts: Parts,
    pkg: Manifest,
    loc: string,
    isDirectRequire: boolean,
    isRequired: boolean,
    isIncompatible: boolean,
  ) {
    this.isDirectRequire = isDirectRequire;
    this.isRequired = isRequired;
    this.isIncompatible = isIncompatible;

    this.loc = loc;
    this.pkg = pkg;
    this.key = key;
    this.parts = parts;
    this.originalKey = key;
    this.previousPaths = [];

    this.history = [];
    this.addHistory(`Start position = ${key}`);

    this.isNohoist = false;
    this.originalParentPath = '';
  }

  isRequired: boolean;
  isIncompatible: boolean;
  isDirectRequire: boolean;
  pkg: Manifest;
  loc: string;
  parts: Parts;
  previousPaths: Array<string>;
  history: Array<string>;
  key: string;
  originalKey: string;

  // nohoist info
  isNohoist: boolean;
  nohoistList: ?Array<string>;
  originalParentPath: string;

  addHistory(msg: string) {
    this.history.push(`${++historyCounter}: ${msg}`);
  }
}

export default class PackageHoister {
  constructor(config: Config, resolver: PackageResolver, {ignoreOptional}: {ignoreOptional: ?boolean} = {}) {
    this.resolver = resolver;
    this.config = config;

    this.ignoreOptional = ignoreOptional;

    this.taintedKeys = new Map();
    this.levelQueue = [];
    this.tree = new Map();

    this.nohoistResolver = new NohoistResolver(config, resolver);
  }

  resolver: PackageResolver;
  config: Config;
  nohoistResolver: NohoistResolver;

  ignoreOptional: ?boolean;

  levelQueue: Array<[string, HoistManifest]>;
  tree: Map<string, HoistManifest>;
  taintedKeys: Map<string, HoistManifest>;

  /**
   * Taint this key and prevent any modules from being hoisted to it.
   */

  taintKey(key: string, info: HoistManifest): boolean {
    const existingTaint = this.taintedKeys.get(key);
    if (existingTaint && existingTaint.loc !== info.loc) {
      return false;
    } else {
      this.taintedKeys.set(key, info);
      return true;
    }
  }

  /**
   * Implode an array of ancestry parts into a key.
   */

  implodeKey(parts: Parts): string {
    return parts.join('#');
  }

  /**
   * Seed the hoister with patterns taken from the included resolver.
   */

  seed(patterns: Array<string>) {
    this.prepass(patterns);

    for (const pattern of this.resolver.dedupePatterns(patterns)) {
      this._seed(pattern, {isDirectRequire: true});
    }

    while (true) {
      let queue = this.levelQueue;
      if (!queue.length) {
        this._propagateRequired();
        return;
      }

      this.levelQueue = [];

      // sort queue to get determinism between runs
      queue = queue.sort(([aPattern], [bPattern]) => {
        return sortAlpha(aPattern, bPattern);
      });

      // sort the queue again to hoist packages without peer dependencies first
      let sortedQueue = [];
      const availableSet = new Set();

      let hasChanged = true;
      while (queue.length > 0 && hasChanged) {
        hasChanged = false;

        for (let t = 0; t < queue.length; ++t) {
          const pattern = queue[t][0];
          const pkg = this.resolver.getStrictResolvedPattern(pattern);

          const peerDependencies = Object.keys(pkg.peerDependencies || {});
          const areDependenciesFulfilled = peerDependencies.every(peerDependency => availableSet.has(peerDependency));

          if (areDependenciesFulfilled) {
            // Move the package inside our sorted queue
            sortedQueue.push(queue[t]);
            queue.splice(t--, 1);

            // Add it to our set, so that we know it is available
            availableSet.add(pattern);

            // Schedule a next pass, in case other packages had peer dependencies on this one
            hasChanged = true;
          }
        }
      }

      // We might end up with some packages left in the queue, that have not been sorted. We reach this codepath if two
      // packages have a cyclic dependency, or if the peer dependency is provided by a parent package. In these case,
      // nothing we can do, so we just add all of these packages to the end of the sorted queue.
      sortedQueue = sortedQueue.concat(queue);

      for (const [pattern, parent] of sortedQueue) {
        const info = this._seed(pattern, {isDirectRequire: false, parent});
        if (info) {
          this.hoist(info);
        }
      }
    }
  }

  /**
   * Seed the hoister with a specific pattern.
   */

  _seed(
    pattern: string,
    {isDirectRequire, parent}: {isDirectRequire: boolean, parent?: HoistManifest},
  ): ?HoistManifest {
    //
    const pkg = this.resolver.getStrictResolvedPattern(pattern);
    const ref = pkg._reference;
    invariant(ref, 'expected reference');

    //
    let parentParts: Parts = [];

    const isIncompatible = ref.incompatible;
    const isMarkedAsOptional = ref.optional && this.ignoreOptional;

    let isRequired = isDirectRequire && !ref.ignore && !isIncompatible && !isMarkedAsOptional;

    if (parent) {
      if (!this.tree.get(parent.key)) {
        return null;
      }
      // non ignored dependencies inherit parent's ignored status
      // parent may transition from ignored to non ignored when hoisted if it is used in another non ignored branch
      if (!isDirectRequire && !isIncompatible && parent.isRequired && !isMarkedAsOptional) {
        isRequired = true;
      }
      parentParts = parent.parts;
    }

    //
    const loc: string = this.config.generateHardModulePath(ref);
    const parts = parentParts.concat(pkg.name);
    const key: string = this.implodeKey(parts);
    const info: HoistManifest = new HoistManifest(key, parts, pkg, loc, isDirectRequire, isRequired, isIncompatible);

    this.nohoistResolver.initNohoist(info, parent);

    this.tree.set(key, info);
    this.taintKey(key, info);

    //
    for (const depPattern of ref.dependencies) {
      this.levelQueue.push([depPattern, info]);
    }

    return info;
  }

  /**
   * Propagate inherited ignore statuses from non-ignored to ignored packages
   */

  _propagateRequired() {
    //
    const toVisit: Array<HoistManifest> = [];

    // enumerate all non-ignored packages
    for (const entry of this.tree.entries()) {
      if (entry[1].isRequired) {
        toVisit.push(entry[1]);
      }
    }

    // visit them
    while (toVisit.length) {
      const info = toVisit.shift();
      const ref = info.pkg._reference;
      invariant(ref, 'expected reference');

      for (const depPattern of ref.dependencies) {
        const depinfo = this._lookupDependency(info, depPattern);

        if (!depinfo) {
          continue;
        }

        const depRef = depinfo.pkg._reference;

        // If it's marked as optional, but the parent is required and the
        // dependency was not listed in `optionalDependencies`, then we mark the
        // dependency as required.
        const isMarkedAsOptional =
          depRef && depRef.optional && this.ignoreOptional && !(info.isRequired && depRef.hint !== 'optional');

        if (!depinfo.isRequired && !depinfo.isIncompatible && !isMarkedAsOptional) {
          depinfo.isRequired = true;
          depinfo.addHistory(`Mark as non-ignored because of usage by ${info.key}`);
          toVisit.push(depinfo);
        }
      }
    }
  }

  /**
   * Looks up the package a dependency resolves to
   */

  _lookupDependency(info: HoistManifest, depPattern: string): ?HoistManifest {
    //
    const pkg = this.resolver.getStrictResolvedPattern(depPattern);
    const ref = pkg._reference;
    invariant(ref, 'expected reference');

    //
    for (let i = info.parts.length; i >= 0; i--) {
      const checkParts = info.parts.slice(0, i).concat(pkg.name);
      const checkKey = this.implodeKey(checkParts);
      const existing = this.tree.get(checkKey);
      if (existing) {
        return existing;
      }
    }

    return null;
  }

  /**
   * Find the highest position we can hoist this module to.
   */

  getNewParts(key: string, info: HoistManifest, parts: Parts): NewPartsType {
    let stepUp = false;

    const highestHoistingPoint = this.nohoistResolver.highestHoistingPoint(info) || 0;
    const fullKey = this.implodeKey(parts);
    const stack = []; // stack of removed parts
    const name = parts.pop();

    if (info.isNohoist) {
      info.addHistory(`Marked as nohoist, will not be hoisted above '${parts[highestHoistingPoint]}'`);
    }

    for (let i = parts.length - 1; i >= highestHoistingPoint; i--) {
      const checkParts = parts.slice(0, i).concat(name);
      const checkKey = this.implodeKey(checkParts);
      info.addHistory(`Looked at ${checkKey} for a match`);

      const existing = this.tree.get(checkKey);

      if (existing) {
        if (existing.loc === info.loc) {
          // switch to non ignored if earlier deduped version was ignored (must be compatible)
          if (!existing.isRequired && info.isRequired) {
            existing.addHistory(`Deduped ${fullKey} to this item, marking as required`);
            existing.isRequired = true;
          } else {
            existing.addHistory(`Deduped ${fullKey} to this item`);
          }

          return {parts: checkParts, duplicate: true};
        } else {
          // everything above will be shadowed and this is a conflict
          info.addHistory(`Found a collision at ${checkKey}`);
          break;
        }
      }

      const existingTaint = this.taintedKeys.get(checkKey);
      if (existingTaint && existingTaint.loc !== info.loc) {
        info.addHistory(`Broken by ${checkKey}`);
        break;
      }
    }

    const peerDependencies = Object.keys(info.pkg.peerDependencies || {});

    // remove redundant parts that wont collide
    hoistLoop: while (parts.length > highestHoistingPoint) {
      // we must not hoist a package higher than its peer dependencies
      for (const peerDependency of peerDependencies) {
        const checkParts = parts.concat(peerDependency);
        const checkKey = this.implodeKey(checkParts);
        info.addHistory(`Looked at ${checkKey} for a peer dependency match`);

        const existing = this.tree.get(checkKey);

        if (existing) {
          info.addHistory(`Found a peer dependency requirement at ${checkKey}`);
          break hoistLoop;
        }
      }

      const checkParts = parts.concat(name);
      const checkKey = this.implodeKey(checkParts);

      //
      const existing = this.tree.get(checkKey);
      if (existing) {
        stepUp = true;
        break;
      }

      // check if we're trying to hoist ourselves to a previously unflattened module key,
      // this will result in a conflict and we'll need to move ourselves up
      if (key !== checkKey && this.taintedKeys.has(checkKey)) {
        stepUp = true;
        break;
      }

      //
      stack.push(parts.pop());
    }

    //
    parts.push(name);

    //
    const isValidPosition = (parts: Parts): boolean => {
      // nohoist package can't be hoisted to the "root"
      if (parts.length <= highestHoistingPoint) {
        return false;
      }
      const key = this.implodeKey(parts);
      const existing = this.tree.get(key);
      if (existing && existing.loc === info.loc) {
        return true;
      }

      // ensure there's no taint or the taint is us
      const existingTaint = this.taintedKeys.get(key);
      if (existingTaint && existingTaint.loc !== info.loc) {
        return false;
      }

      return true;
    };

    // we need to special case when we attempt to hoist to the top level as the `existing` logic
    // wont be hit in the above `while` loop and we could conflict
    if (!isValidPosition(parts)) {
      stepUp = true;
    }

    // sometimes we need to step up to a parent module to install ourselves
    while (stepUp && stack.length) {
      info.addHistory(`Stepping up from ${this.implodeKey(parts)}`);

      parts.pop(); // remove `name`
      parts.push(stack.pop(), name);

      if (isValidPosition(parts)) {
        info.addHistory(`Found valid position ${this.implodeKey(parts)}`);
        stepUp = false;
      }
    }

    return {parts, duplicate: false};
  }

  /**
   * Hoist all seeded patterns to their highest positions.
   */

  hoist(info: HoistManifest) {
    const {key: oldKey, parts: rawParts} = info;

    // remove this item from the `tree` map so we can ignore it
    this.tree.delete(oldKey);
    const {parts, duplicate} = this.getNewParts(oldKey, info, rawParts.slice());

    const newKey = this.implodeKey(parts);
    if (duplicate) {
      info.addHistory(`Satisfied from above by ${newKey}`);
      this.declareRename(info, rawParts, parts);
      this.updateHoistHistory(this.nohoistResolver._originalPath(info), this.implodeKey(parts));
      return;
    }

    // update to the new key
    if (oldKey === newKey) {
      info.addHistory(`Didn't hoist - see reason above`);
      this.setKey(info, oldKey, rawParts);
      return;
    }

    //
    this.declareRename(info, rawParts, parts);
    this.setKey(info, newKey, parts);
  }

  /**
   * Declare that a module has been hoisted and update our internal references.
   */

  declareRename(info: HoistManifest, oldParts: Array<string>, newParts: Array<string>) {
    // go down the tree from our new position reserving our name
    this.taintParents(info, oldParts.slice(0, -1), newParts.length - 1);
  }

  /**
   * Crawl upwards through a list of ancestry parts and taint a package name.
   */

  taintParents(info: HoistManifest, processParts: Array<string>, start: number) {
    for (let i = start; i < processParts.length; i++) {
      const parts = processParts.slice(0, i).concat(info.pkg.name);
      const key = this.implodeKey(parts);

      if (this.taintKey(key, info)) {
        info.addHistory(`Tainted ${key} to prevent collisions`);
      }
    }
  }

  updateHoistHistory(fromPath: string, toKey: string) {
    const info = this.tree.get(toKey);
    invariant(info, `expect to find hoist-to ${toKey}`);
    info.previousPaths.push(fromPath);
  }

  /**
   * Update the key of a module and update our references.
   */

  setKey(info: HoistManifest, newKey: string, parts: Array<string>) {
    const oldKey = info.key;

    info.key = newKey;
    info.parts = parts;
    this.tree.set(newKey, info);

    if (oldKey === newKey) {
      return;
    }

    const fromInfo = this.tree.get(newKey);
    invariant(fromInfo, `expect to find hoist-from ${newKey}`);
    info.previousPaths.push(this.nohoistResolver._originalPath(fromInfo));
    info.addHistory(`New position = ${newKey}`);
  }

  /**
   * Perform a prepass and if there's multiple versions of the same package, hoist the one with
   * the most dependents to the top.
   */

  prepass(patterns: Array<string>) {
    patterns = this.resolver.dedupePatterns(patterns).sort();

    const visited: Map<
      string,
      Array<{
        pkg: Manifest,
        ancestry: Array<Manifest>,
        pattern: string,
      }>,
    > = new Map();

    const occurences: {
      [packageName: string]: {
        [version: string]: {
          pattern: string,
          occurences: Set<Manifest>,
        },
      },
    } = {};

    // visitor to be used inside add() to mark occurences of packages
    const visitAdd = (pkg: Manifest, ancestry: Array<Manifest>, pattern: string) => {
      const versions = (occurences[pkg.name] = occurences[pkg.name] || {});
      const version = (versions[pkg.version] = versions[pkg.version] || {
        occurences: new Set(),
        pattern,
      });

      if (ancestry.length) {
        version.occurences.add(ancestry[ancestry.length - 1]);
      }
    };

    // add an occurring package to the above data structure
    const add = (pattern: string, ancestry: Array<Manifest>, ancestryPatterns: Array<string>) => {
      const pkg = this.resolver.getStrictResolvedPattern(pattern);
      if (ancestry.indexOf(pkg) >= 0) {
        // prevent recursive dependencies
        return;
      }

      let visitedPattern = visited.get(pattern);

      if (visitedPattern) {
        // if a package has been visited before, simply increment occurrences of packages
        // like last time this package was visited
        visitedPattern.forEach(visitPkg => {
          visitAdd(visitPkg.pkg, visitPkg.ancestry, visitPkg.pattern);
        });

        visitAdd(pkg, ancestry, pattern);

        return;
      }

      const ref = pkg._reference;
      invariant(ref, 'expected reference');

      visitAdd(pkg, ancestry, pattern);

      for (const depPattern of ref.dependencies) {
        const depAncestry = ancestry.concat(pkg);
        const depAncestryPatterns = ancestryPatterns.concat(depPattern);
        add(depPattern, depAncestry, depAncestryPatterns);
      }

      visitedPattern = visited.get(pattern) || [];
      visited.set(pattern, visitedPattern);
      visitedPattern.push({pkg, ancestry, pattern});

      ancestryPatterns.forEach(ancestryPattern => {
        const visitedAncestryPattern = visited.get(ancestryPattern);
        if (visitedAncestryPattern) {
          visitedAncestryPattern.push({pkg, ancestry, pattern});
        }
      });
    };

    // get a list of root package names since we can't hoist other dependencies to these spots!
    const rootPackageNames: Set<string> = new Set();
    for (const pattern of patterns) {
      const pkg = this.resolver.getStrictResolvedPattern(pattern);
      rootPackageNames.add(pkg.name);
      add(pattern, [], []);
    }

    for (const packageName of Object.keys(occurences).sort()) {
      const versionOccurences = occurences[packageName];
      const versions = Object.keys(versionOccurences);

      if (versions.length === 1) {
        // only one package type so we'll hoist this to the top anyway
        continue;
      }

      if (this.tree.get(packageName)) {
        // a transitive dependency of a previously hoisted dependency exists
        continue;
      }

      if (rootPackageNames.has(packageName)) {
        // can't replace top level packages
        continue;
      }

      let mostOccurenceCount;
      let mostOccurencePattern;
      for (const version of Object.keys(versionOccurences).sort()) {
        const {occurences, pattern} = versionOccurences[version];
        const occurenceCount = occurences.size;

        if (!mostOccurenceCount || occurenceCount > mostOccurenceCount) {
          mostOccurenceCount = occurenceCount;
          mostOccurencePattern = pattern;
        }
      }
      invariant(mostOccurencePattern, 'expected most occurring pattern');
      invariant(mostOccurenceCount, 'expected most occurring count');

      // only hoist this module if it occured more than once
      if (mostOccurenceCount > 1) {
        this._seed(mostOccurencePattern, {isDirectRequire: false});
      }
    }
  }

  /**
   * Produce a flattened list of module locations and manifests.
   */

  init(): HoistManifestTuples {
    const flatTree = [];

    //
    for (const [key, info] of this.tree.entries()) {
      // decompress the location and push it to the flat tree. this path could be made
      // up of modules from different registries so we need to handle this specially
      const parts: Array<string> = [];
      const keyParts = key.split('#');
      for (let i = 0; i < keyParts.length; i++) {
        const key = keyParts.slice(0, i + 1).join('#');
        const hoisted = this.tree.get(key);
        invariant(hoisted, 'expected hoisted manifest');
        parts.push(this.config.getFolder(hoisted.pkg));
        parts.push(keyParts[i]);
      }

      if (this.config.modulesFolder) {
        // remove the first part which will be the folder name and replace it with a
        // hardcoded modules folder
        parts.splice(0, 1, this.config.modulesFolder);
      } else {
        // first part will be the registry-specific module folder
        parts.splice(0, 0, this.config.lockfileFolder);
      }

      const loc = path.join(...parts);
      flatTree.push([loc, info]);
    }

    // remove ignored modules from the tree
    const visibleFlatTree = [];
    for (const [loc, info] of flatTree) {
      const ref = info.pkg._reference;
      invariant(ref, 'expected reference');
      if (!info.isRequired) {
        info.addHistory('Deleted as this module was ignored');
      } else {
        visibleFlatTree.push([loc, info]);
      }
    }
    return visibleFlatTree;
  }
}

const WS_ROOT_ALIAS = '_project_';
export class NohoistResolver {
  constructor(config: Config, resolver: PackageResolver) {
    this._resolver = resolver;
    this._config = config;
    if (resolver.workspaceLayout) {
      this._wsRootPackageName = resolver.workspaceLayout.virtualManifestName;
      const {manifest} = resolver.workspaceLayout.getWorkspaceManifest(this._wsRootPackageName);
      this._wsRootNohoistList = this._extractNohoistList(manifest, manifest.name);
    }
  }
  _resolver: PackageResolver;
  _config: Config;
  _wsRootNohoistList: ?Array<string>;
  _wsRootPackageName: ?string;

  /**
   * examine the top level packages to find the root package
   */
  initNohoist = (info: HoistManifest, parent: ?HoistManifest) => {
    let parentNohoistList: ?Array<string>;
    let originalParentPath: string = info.originalParentPath;

    if (parent) {
      parentNohoistList = parent.nohoistList;
      originalParentPath = this._originalPath(parent);
    } else {
      invariant(this._isTopPackage(info), `${info.key} doesn't have parent nor a top package`);
      if (info.pkg.name !== this._wsRootPackageName) {
        parentNohoistList = this._wsRootNohoistList;
        originalParentPath = this._wsRootPackageName || '';
      }
    }

    info.originalParentPath = originalParentPath;
    let nohoistList = this._extractNohoistList(info.pkg, this._originalPath(info)) || [];
    if (parentNohoistList) {
      nohoistList = nohoistList.concat(parentNohoistList);
    }
    info.nohoistList = nohoistList.length > 0 ? nohoistList : null;
    info.isNohoist = this._isNohoist(info);
  };

  /**
   * find the highest hoisting point for the given HoistManifest.
   * algorithm: a nohoist package should never be hoisted beyond the top of its branch, i.e.
   * the first element of its parts. Therefore the highest possible hoisting index is 1,
   * unless the package has only 1 part (itself), in such case returns null just like any hoisted package
   * 
   */

  highestHoistingPoint = (info: HoistManifest): ?number => {
    return info.isNohoist && info.parts.length > 1 ? 1 : null;
  };

  // private functions
  _isNohoist = (info: HoistManifest): boolean => {
    if (!info.nohoistList || info.nohoistList.length <= 0) {
      return false;
    }
    const path = this._originalPath(info);

    // top package can not be marked 'nohoist' because it is already at the top (hoisted).
    return !this._isTopPackage(info) && mm.any(path, info.nohoistList);
  };
  _isRootPackage = (pkg: Manifest): boolean => {
    return pkg.name === this._wsRootPackageName;
  };
  _originalPath = (info: HoistManifest): string => {
    return this._makePath(info.originalParentPath, info.pkg.name);
  };
  _makePath(...args: Array<string>): string {
    const parts = args.map(s => (s === this._wsRootPackageName ? WS_ROOT_ALIAS : s));
    return parts.join('/');
  }
  _isTopPackage = (info: HoistManifest): boolean => {
    const parentParts = info.parts.slice(0, -1);
    const result =
      !parentParts ||
      parentParts.length <= 0 ||
      (parentParts.length === 1 && parentParts[0] === this._wsRootPackageName);
    return result;
  };
  _isLink = (info: HoistManifest): boolean => {
    return info.pkg._remote != null && LINK_TYPES.has(info.pkg._remote.type);
  };

  // extract nohoist from package.json then prefix them with branch path
  // so we can matched against the branch tree ("originalPath") later
  _extractNohoistList = (pkg: Manifest, pathPrefix: string): ?Array<string> => {
    let nohoistList: ?Array<string>;
    const ws = this._config.getWorkspaces(pkg);

    if (ws && ws.nohoist) {
      nohoistList = ws.nohoist.map(p => this._makePath(pathPrefix, p));
    }
    return nohoistList;
  };
}

export type HoistManifestTuple = [string, HoistManifest];
export type HoistManifestTuples = Array<HoistManifestTuple>;
