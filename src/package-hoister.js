/* @flow */

import type PackageResolver from './package-resolver.js';
import type Config from './config.js';
import type {Manifest} from './types.js';
import {sortAlpha} from './util/misc.js';

const invariant = require('invariant');
const path = require('path');

type Parts = Array<string>;

let historyCounter = 0;

export class HoistManifest {
  constructor(key: string, parts: Parts, pkg: Manifest, loc: string, isRequired: boolean, isIncompatible: boolean) {
    this.isRequired = isRequired;
    this.isIncompatible = isIncompatible;
    this.loc = loc;
    this.pkg = pkg;

    this.key = key;
    this.parts = parts;
    this.originalKey = key;
    this.previousKeys = [];

    this.history = [];
    this.addHistory(`Start position = ${key}`);
  }

  isRequired: boolean;
  isIncompatible: boolean;
  pkg: Manifest;
  loc: string;
  parts: Parts;
  previousKeys: Array<string>;
  history: Array<string>;
  key: string;
  originalKey: string;

  addHistory(msg: string) {
    this.history.push(`${++historyCounter}: ${msg}`);
  }
}

export default class PackageHoister {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.config = config;

    this.taintedKeys = new Map();
    this.levelQueue = [];
    this.tree = new Map();
  }

  resolver: PackageResolver;
  config: Config;

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
      this._seed(pattern);
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

      //
      const infos = [];
      for (const [pattern, parents] of queue) {
        const info = this._seed(pattern, parents);
        if (info) {
          infos.push(info);
        }
      }

      //
      for (const info of infos) {
        this.hoist(info);
      }
    }
  }

  /**
   * Seed the hoister with a specific pattern.
   */

  _seed(pattern: string, parent?: HoistManifest): ?HoistManifest {
    //
    const pkg = this.resolver.getStrictResolvedPattern(pattern);
    const ref = pkg._reference;
    invariant(ref, 'expected reference');

    //
    let parentParts: Parts = [];
    const isIncompatible = ref.incompatible;
    let isRequired = !parent && !ref.ignore && !isIncompatible;

    if (parent) {
      if (!this.tree.get(parent.key)) {
        return null;
      }
      // non ignored dependencies inherit parent's ignored status
      // parent may transition from ignored to non ignored when hoisted if it is used in another non ignored branch
      if (!isRequired && !isIncompatible && parent.isRequired) {
        isRequired = true;
      }
      parentParts = parent.parts;
    }

    //
    const loc: string = this.config.generateHardModulePath(ref);
    const parts = parentParts.concat(pkg.name);
    const key: string = this.implodeKey(parts);
    const info: HoistManifest = new HoistManifest(key, parts, pkg, loc, isRequired, isIncompatible);

    //
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
        if (depinfo && !depinfo.isRequired && !depinfo.isIncompatible) {
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

  getNewParts(
    key: string,
    info: HoistManifest,
    parts: Parts,
  ): {
    parts: Parts,
    duplicate: boolean,
  } {
    let stepUp = false;

    const fullKey = this.implodeKey(parts);
    const stack = []; // stack of removed parts
    const name = parts.pop();

    //
    for (let i = parts.length - 1; i >= 0; i--) {
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

    // remove redundant parts that wont collide
    while (parts.length) {
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
    const {key, parts: rawParts} = info;

    // remove this item from the `tree` map so we can ignore it
    this.tree.delete(key);

    const {parts, duplicate} = this.getNewParts(key, info, rawParts.slice());
    const newKey = this.implodeKey(parts);
    const oldKey = key;
    if (duplicate) {
      info.addHistory(`Satisfied from above by ${newKey}`);
      this.declareRename(info, rawParts, parts);
      return;
    }

    // update to the new key
    if (oldKey === newKey) {
      info.addHistory("Didn't hoist - conflicts above");
      this.setKey(info, oldKey, parts);
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

    info.previousKeys.push(newKey);
    info.addHistory(`New position = ${newKey}`);
  }

  /**
   * Perform a prepass and if there's multiple versions of the same package, hoist the one with
   * the most dependents to the top.
   */

  prepass(patterns: Array<string>) {
    patterns = this.resolver.dedupePatterns(patterns).sort();

    const occurences: {
      [packageName: string]: {
        [version: string]: {
          pattern: string,
          occurences: Set<Manifest>,
        },
      },
    } = {};

    // add an occuring package to the above data structure
    const add = (pattern: string, ancestry: Array<Manifest>) => {
      const pkg = this.resolver.getStrictResolvedPattern(pattern);
      if (ancestry.indexOf(pkg) >= 0) {
        // prevent recursive dependencies
        return;
      }

      const ref = pkg._reference;
      invariant(ref, 'expected reference');

      const versions = (occurences[pkg.name] = occurences[pkg.name] || {});
      const version = (versions[pkg.version] = versions[pkg.version] || {
        occurences: new Set(),
        pattern,
      });
      version.occurences.add(ancestry[ancestry.length - 1]);

      for (const depPattern of ref.dependencies) {
        add(depPattern, ancestry.concat(pkg));
      }
    };

    // get a list of root package names since we can't hoist other dependencies to these spots!
    const rootPackageNames: Set<string> = new Set();
    for (const pattern of patterns) {
      const pkg = this.resolver.getStrictResolvedPattern(pattern);
      rootPackageNames.add(pkg.name);
    }

    // seed occurences
    for (const pattern of patterns) {
      add(pattern, []);
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
      invariant(mostOccurencePattern, 'expected most occuring pattern');
      invariant(mostOccurenceCount, 'expected most occuring count');

      // only hoist this module if it occured more than once
      if (mostOccurenceCount > 1) {
        this._seed(mostOccurencePattern);
      }
    }
  }

  /**
   * Produce a flattened list of module locations and manifests.
   */

  init(): Array<[string, HoistManifest]> {
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
        parts.shift();
        const modulesFolder = this.config.modulesFolder == null ? '' : this.config.modulesFolder;
        parts.unshift(modulesFolder);
      } else {
        // first part will be the registry-specific module folder
        const cwd = this.config.cwd == null ? '' : this.config.cwd;
        parts.unshift(cwd);
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

export type HoistManifestTuple = [string, HoistManifest];
export type HoistManifestTuples = Array<HoistManifestTuple>;
