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

import type PackageResolver from "./package-resolver.js";
import type Config from "./config.js";
import type { Manifest } from "./types.js";

let invariant = require("invariant");
let path = require("path");

let historyCounter = 0;

export class HoistManifest {
  constructor(key: string, pkg: Manifest, loc: string) {
    this.loc = loc;
    this.pkg = pkg;

    this.key = key;
    this.originalKey = key;
    this.previousKeys = [];

    this.transitivePairs = new Set;

    this.history = [];
    this.addHistory(`Start position = ${key}`);
  }

  pkg: Manifest;
  loc: string;
  previousKeys: Array<string>;
  history: Array<string>;
  transitivePairs: Set<HoistPair>;
  key: string;
  originalKey: string;

  addHistory(msg: string) {
    this.history.push(`${++historyCounter}: ${msg}`);
  }

  addTransitive(pairs: Iterable<HoistPair>) {
    for (let pair of pairs) this.transitivePairs.add(pair);
  }
}

export type HoistPair = [string, HoistManifest];

export default class PackageHoister {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.config = config;

    this.taintedKeys = new Map;
    this.tree = new Map;

    // we need to zip up the tree as we we're using it as a map and will be actively
    // removing and deleting keys during enumeration
    this.zippedTree = [];
  }

  resolver: PackageResolver;
  config: Config;

  zippedTree: Array<HoistPair>;
  tree: Map<string, HoistManifest>;
  taintedKeys: Map<string, HoistManifest>;

  /**
   * Taint this key and prevent any modules from being hoisted to it.
   */

  taintKey(key: string, info: HoistManifest): boolean {
    let existingTaint = this.taintedKeys.get(key);
    if (existingTaint && existingTaint.loc !== info.loc) {
      return false;
    } else {
      this.taintedKeys.set(key, info);
      return true;
    }
  }

  /**
   * Explode a `key` into it's ancestry parts.
   */

  explodeKey(key: string): Array<string> {
    return key.split("#");
  }

  /**
   * Implode an array of ancestry parts into a key.
   */

  implodeKey(parts: Array<string>): string {
    return parts.join("#");
  }

  /**
   * Seed the hoister with patterns taken from the included resolver.
   */

  seed(patterns: Array<string>) {
    for (let pattern of this.resolver.dedupePatterns(patterns)) {
      this._seed(pattern, []);
    }
  }

  /**
   * Seed the hoister with a specific pattern.
   */

  _seed(pattern: string, parentParts: Array<string>): Array<HoistPair> {
    if (parentParts.length >= 100) {
      throw new Error(
        "We're in too deep - module max stack depth reached. http://youtu.be/emGri7i8Y2Y"
      );
    }

    //
    let pkg = this.resolver.getStrictResolvedPattern(pattern);
    let ref = pkg.reference;
    invariant(ref, "expected reference");
    let loc = this.config.generateHardModulePath(ref);

    // prevent a dependency from having itself as a transitive dependency
    let ownParts = parentParts.slice();
    for (let i = ownParts.length; i >= 0; i--) {
      let checkParts = ownParts.slice(0, i);
      let checkKey = this.implodeKey(checkParts);
      let check = this.tree.get(checkKey);
      if (check && check.loc === loc) {
        this.taintKey(checkKey, check);
        check.addHistory(`${checkKey} was removed by this due to being a recursive transitive dep`);
        return [];
      }
    }

    //
    ownParts.push(pkg.name);

    let key = this.implodeKey(ownParts);
    let info: HoistManifest = new HoistManifest(key, pkg, loc);
    let pair: HoistPair = [key, info];

    //
    this.zippedTree.push(pair);
    this.tree.set(key, info);
    this.taintKey(key, info);

    //
    let results: Array<HoistPair> = [];

    // add dependencies
    for (let depPattern of ref.dependencies) {
      results = results.concat(this._seed(depPattern, ownParts));
    }

    //
    info.addTransitive(results);

    //
    results.push(pair);

    return results;
  }

  /**
   * Find the highest position we can hoist this module to.
   */

  getNewParts(key: string, info: HoistManifest, parts: Array<string>): {
    parts: Array<string>;
    existing: ?HoistManifest;
    duplicate: boolean;
  } {
    let stepUp = false;
    let stack = []; // stack of removed parts
    let name = parts.pop();

    //
    for (let i = parts.length - 1; i >= 0; i--) {
      let checkParts = parts.slice(0, i).concat(name);
      let checkKey   = this.implodeKey(checkParts);
      info.addHistory(`Looked at ${checkKey} for a match`);

      let existing = this.tree.get(checkKey);
      if (existing) {
        if (existing.loc === info.loc) {
          return { parts: checkParts, existing, duplicate: true };
        } else {
          // everything above will be shadowed and this is a conflict
          info.addHistory(`Found a collision at ${checkKey}`);
          break;
        }
      }

      let existingTaint = this.taintedKeys.get(checkKey);
      if (existingTaint && existingTaint.loc !== info.loc) {
        info.addHistory(`Broken by ${checkKey}`);
        break;
      }
    }

    // remove redundant parts that wont collide
    while (parts.length) {
      let checkParts = parts.concat(name);
      let checkKey = this.implodeKey(checkParts);

      //
      let existing = this.tree.get(checkKey);
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
    let existing;
    let isValidPosition = (parts: Array<string>): boolean => {
      let key = this.implodeKey(parts);
      existing = this.tree.get(key);
      if (existing && existing.loc === info.loc) {
        return true;
      }

      // ensure there's no taint or the taint is us
      let existingTaint = this.taintedKeys.get(key);
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

    return { parts, existing, duplicate: false };
  }

  /**
   * Check if the parent referenced in a list of ancestry parts exists.
   */

  isOrphan(parts: Array<string>): boolean {
    let parentKey = this.implodeKey(parts.slice(0, -1));
    return !!parentKey && !this.tree.get(parentKey);
  }

  /**
   * Hoist all seeded patterns to their highest positions.
   */

  hoist() {
    for (let i = 0; i < this.zippedTree.length; i++) {
      let pair: HoistPair = this.zippedTree[i];
      let [key, info] = pair;

      let rawParts = this.explodeKey(key);

      // nothing to hoist, already top level
      if (rawParts.length === 1) {
        info.addHistory("Can't hoist - already top level");
        continue;
      }

      // remove this item from the `tree` map so we can ignore it
      this.tree.delete(key);

      //
      if (this.isOrphan(rawParts)) {
        info.addHistory("Deleting as we're an orphan");
        continue;
      }

      //
      let { parts, existing, duplicate } = this.getNewParts(key, info, rawParts.slice());
      let newKey = this.implodeKey(parts);
      let oldKey = key;
      if (duplicate) {
        info.addHistory(`Satisfied from above by ${newKey}`);
        this.declareRename(info, existing, rawParts, parts, pair);
        continue;
      }

      // update to the new key
      if (oldKey === newKey) {
        info.addHistory("Didn't hoist - conflicts above");
        this.setKey(info, pair, oldKey);
        continue;
      }

      //
      this.declareRename(info, existing, rawParts, parts, pair);
      this.setKey(info, pair, newKey);
      this.updateTransitiveKeys(info, oldKey, newKey);
    }
  }

  /**
   * Declare that a module has been hoisted and update our internal references.
   */

  declareRename(
    info: HoistManifest,
    existing: ?HoistManifest,
    oldParts: Array<string>,
    newParts: Array<string>,
    pair: HoistPair
  ) {
    if (existing && existing !== info) {
      info.addTransitive(existing.transitivePairs);
    }

    //
    let newParentParts = newParts.slice(0, -1);
    let newParentKey = this.implodeKey(newParentParts);
    if (newParentKey) {
      let parent = this.tree.get(newParentKey);
      invariant(parent, `couldn't find parent ${newParentKey}`);
      parent.addTransitive([pair]);
    }

    // go down the tree from our new position reserving our name
    this.taintParents(info, oldParts.slice(0, -1), newParts.length - 1);
  }

  /**
   * Crawl upwards through a list of ancestry parts and taint a package name.
   */

  taintParents(info: HoistManifest, processParts: Array<string>, start: number) {
    for (let i = start; i < processParts.length; i++) {
      let parts = processParts.slice(0, i).concat(info.pkg.name);
      let key = this.implodeKey(parts);

      if (this.taintKey(key, info)) {
        info.addHistory(`Tainted ${key} to prevent collisions`);
      }
    }
  }

  /**
   * Update all transitive deps of this module with the new hoisted key.
   */

  updateTransitiveKeys(info: HoistManifest, oldKey: string, newKey: string) {
    // go through and update all transitive dependencies and update their keys to the new
    // hoisting position
    let oldKeyRegex = new RegExp(`^${oldKey}#`);

    let pairs = info.transitivePairs;
    invariant(pairs, "expected pairs");

    for (let subPair of pairs) {
      let [subKey] = subPair;
      if (subKey === newKey) continue;

      let subInfo = this.tree.get(subKey);
      if (!subInfo) continue;

      let newSubKey = subKey.replace(oldKeyRegex, `${newKey}#`);
      if (newSubKey === subKey) continue;

      // restrict use of the new key in case we hoist it further from here
      this.taintedKeys.set(newSubKey, subInfo);

      // update references
      this.setKey(subInfo, subPair, newSubKey);
      this.tree.delete(subKey);
      subInfo.addHistory(`Deleted ${subKey}`);
    }
  }

  /**
   * Update the key of a module and update our references.
a   */

  setKey(info: HoistManifest, pair: HoistPair, newKey: string) {
    let oldKey = info.key;

    info.key = newKey;
    pair[0] = newKey;
    this.tree.set(newKey, info);

    if (oldKey === newKey) return;
    info.previousKeys.push(newKey);
    info.addHistory(`New position = ${newKey}`);
  }

  /**
   * Produce a flattened list of module locations and manifests.
   */

  flatten(): Array<[string, HoistManifest]> {
    let flatTree = [];

    // remove ignored modules from the tree
    for (let [key, info] of this.tree.entries()) {
      let ref = info.pkg.reference;
      invariant(ref, "expected reference");
      if (ref.ignore) {
        info.addHistory("Deleted as this module was ignored");
        this.tree.delete(key);
      }
    }

    //
    for (let [key, info] of this.tree.entries()) {
      if (this.isOrphan(this.explodeKey(key))) continue;

      // decompress the location and push it to the flat tree
      let loc = path.join(this.config.modulesFolder, key.replace(/#/g, "/node_modules/"));
      flatTree.push([loc, info]);
    }

    return flatTree;
  }

  /**
   * Hoist and return flattened list of modules.
   */

  init(): Array<[string, HoistManifest]> {
    this.hoist();
    return this.flatten();
  }
}
