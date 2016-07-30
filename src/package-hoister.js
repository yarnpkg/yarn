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

import type { HoistManifest, HoistPair } from "./types.js";
import type PackageResolver from "./package-resolver.js";
import type Config from "./config.js";

let invariant = require("invariant");
let path = require("path");

export default class PackageHoister {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.config = config;

    // we need to zip up the tree as we we're using it as a hash map and will be actively
    // removing and deleting keys during enumeration
    this.zippedTree = [];
    this.tree = new Map;

    this.unflattenedKeys = new Set;
    this.subPairs = new Map;

    this.aliases = new Map;
  }

  resolver: PackageResolver;
  config: Config;

  zippedTree: Array<HoistPair>;
  aliases: Map<string, string>;
  tree: Map<string, HoistManifest>;
  unflattenedKeys: Set<string>;
  subPairs: Map<HoistManifest, Set<HoistPair>>;

  /**
   * Description
   */

  blacklistKey(key: string) {
    if (this.unflattenedKeys.has(key)) return;
    this.unflattenedKeys.add(key);
  }

  /**
   * Description
   */

  explodeKey(key: string): Array<string> {
    return key.split("#");
  }

  /**
   * Description
   */

  implodeKey(parts: Array<string>): string {
    let key = parts.join("#");

    // loop through aliases
    let alias;
    while (alias = this.aliases.get(key)) {
      key = alias;
    }

    return key;
  }

  /**
   * Description
   */

  build(pattern: string, parentParts: Array<string>, parentManifest?: HoistManifest): Array<HoistPair> {
    if (parentParts.length >= 100) {
      throw new Error(
        "We're in too deep - module max stack depth reached. http://youtu.be/emGri7i8Y2Y"
      );
    }

    //
    let pkg = this.resolver.getResolvedPattern(pattern);
    let loc = this.config.generateHardModulePath(pkg.reference);

    // prevent a dependency from having itself as a transitive dependency
    let ownParts = parentParts.slice();
    for (let i = ownParts.length; i >= 0; i--) {
      let checkParts = ownParts.slice(0, i);
      let checkKey = this.implodeKey(checkParts);
      let check = this.tree.get(checkKey);
      if (check && check.loc === loc) {
        // we have a compatible module above us, we should mark the current
        // module key as restricted and continue on
        let finalParts = ownParts.concat(pkg.name);
        let finalKey = this.implodeKey(finalParts);
        this.blacklistKey(finalKey);
        check.hoistedFrom.push(finalKey);

        if (parentManifest) {
          parentManifest.requireReachable.add(check);
        }

        return [];
      }
    }

    //
    ownParts.push(pkg.name);

    let key = this.implodeKey(ownParts);
    let info: HoistManifest = {
      loc,
      pkg,
      hoistedFrom: [key],
      requireReachable: new Set,
      key,
      originalKey: key
    };
    let pair: HoistPair = [key, info];

    //
    this.zippedTree.push(pair);
    this.tree.set(key, info);
    this.blacklistKey(key);

    //
    if (parentManifest) {
      // register this manifest as required to be resolved relative to wherever
      // it's hoisted to
      parentManifest.requireReachable.add(info);
    }

    //
    let results: Array<HoistPair> = [];

    // add dependencies
    for (let depPattern of pkg.reference.dependencies) {
      results = results.concat(this.build(depPattern, ownParts, info));
    }

    //
    this.subPairs.set(info, new Set(results.slice()));

    //
    results.push(pair);

    return results;
  }

  /**
   * Description
   */

  seed(patterns: Array<string>) {
    for (let pattern of this.resolver.dedupePatterns(patterns)) {
      this.build(pattern, []);
    }
  }

  /**
   * Description
   */

  getNewParts(key: string, info: HoistManifest, parts: Array<string>): {
    parts: Array<string>;
    existing: ?HoistManifest;
    duplicate: boolean;
  } {
    let stepUp = false;
    let stack = []; // stack of removed parts

    // remove redundant parts that wont collide
    let name = parts.pop();
    while (parts.length) {
      let checkParts = parts.concat(name);
      let checkKey   = this.implodeKey(checkParts);

      //
      let existing = this.tree.get(checkKey);
      if (existing) {
        if (existing.loc === info.loc) {
          return { parts, existing, duplicate: true };
        } else {
          break;
        }
      }

      // check if we're trying to hoist ourselves to a previously unflattened module key,
      // this will result in a conflict and we'll need to move ourselves up
      if (key !== checkKey && this.unflattenedKeys.has(checkKey)) {
        stepUp = true;
        break;
      }

      // check dependencies and ensure we can access them from here
      if (this.hasUnreachableDependencies(info.requireReachable, checkParts)) {
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
      } else {
        return !this.unflattenedKeys.has(key);
      }
    };

    // we need to special case when we attempt to hoist to the top level as the `existing` logic
    // wont be hit in the above `while` loop and we could conflict
    if (!isValidPosition(parts)) {
      stepUp = true;
    }

    // sometimes we need to step up to a parent module to install ourselves
    while (stepUp && stack.length) {
      parts.pop(); // remove `name`
      parts.push(stack.pop(), name);

      if (isValidPosition(parts)) {
        stepUp = false;
      }
    }

    return { parts, existing, duplicate: false };
  }

  /**
   * Description
   */

  hasUnreachableDependencies(manifests: Iterable<HoistManifest>, parts: Array<string>): boolean {
    for (let manifest of manifests) {
      if (this.isUnreachableDependency(manifest, parts.slice())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Description
   */

  isOrphan(parts: Array<string>): boolean {
    let parentKey = this.implodeKey(parts.slice(0, -1));
    return parentKey && !this.tree.get(parentKey);
  }

  /**
   * Description
   */

  hoist() {
    for (let i = 0; i < this.zippedTree.length; i++) {
      let pair: HoistPair = this.zippedTree[i];
      let [key, info] = pair;

      let rawParts = this.explodeKey(key);

      // nothing to hoist, already top level
      if (rawParts.length === 1) continue;

      // remove this item from the `tree` map so we can ignore it
      this.tree.delete(key);

      //
      if (this.isOrphan(rawParts)) continue;

      //
      let { parts, existing, duplicate } = this.getNewParts(key, info, rawParts.slice());
      if (duplicate) {
        this.declareRename(info, existing, rawParts, parts, pair);
        continue;
      }

      // update to the new key
      let oldKey = key;
      let newKey = this.implodeKey(parts);
      if (oldKey === newKey) {
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
   * Description
   */

  declareRename(
    info: HoistManifest,
    existing: ?HoistManifest,
    oldParts: Array<string>,
    newParts: Array<string>,
    pair: HoistPair
  ) {
    if (existing && existing !== info) {
      this.subPairs.set(info, new Set([
        ...this.subPairs.get(existing) || [],
        ...this.subPairs.get(info) || []
      ]));
    }

    //
    let newParentParts = newParts.slice(0, -1);
    let newParentKey = this.implodeKey(newParentParts);
    if (newParentKey) {
      let parent = this.tree.get(newParentKey);
      invariant(parent, `couldn't find parent ${newParentKey}`);

      let pairs = this.subPairs.get(parent);
      if (pairs) {
        pairs.add(pair);
      }
    }

    // go down the tree from our new position reserving our name
    this.reserve(info.pkg.name, newParentParts);
    this.reserve(info.pkg.name, oldParts.slice(0, -1));
  }

  reserve(name: string, processParts: Array<string>) {
    this.blacklistKey(name, [name]);

    let totalParts = [];

    for (let i = 0; i < processParts.length; i++) {
      totalParts.push(processParts[i]);

      let parts = [].concat(totalParts, name);
      let key = this.implodeKey(parts);
      this.blacklistKey(key, parts);
    }
  }

  /**
   * Description
   */

  updateTransitiveKeys(info: HoistManifest, oldKey: string, newKey: string) {
    // go through and update all transitive dependencies and update their keys to the new
    // hoisting position
    let pairs = this.subPairs.get(info);
    invariant(pairs, "expected pairs");
    for (let subPair of pairs) {
      let [subKey] = subPair;
      if (subKey === newKey) continue;

      let subInfo = this.tree.get(subKey);
      if (!subInfo) continue;

      let newSubKey = subKey.replace(new RegExp(`^${oldKey}#`), `${newKey}#`);
      if (newSubKey === subKey) continue;

      // restrict use of the new key in case we hoist it further from here
      this.unflattenedKeys.add(newSubKey);

      // update references
      this.setKey(subInfo, subPair, newSubKey);
      this.tree.delete(subKey);
    }
  }

  /**
   * Description
   */

  setKey(info: HoistManifest, pair: HoistPair, newKey: string) {
    let oldKey = info.key;

    if (oldKey !== newKey) {
      this.aliases.set(oldKey, newKey);
      info.key = newKey;
      pair[0] = newKey;
    }

    this.tree.set(newKey, info);
  }

  /**
   * Description
   */

  isUnreachableDependency(info: HoistManifest, parts: Array<string>): boolean {
    while (true) {
      let checkKey = this.implodeKey(parts.concat(info.pkg.name));
      let existing = this.tree.get(checkKey);

      if (existing) {
        if (existing.loc === info.loc) {
          return false;
        } else {
          return true;
        }
      }

      if (parts.length) {
        parts.pop();
      } else {
        return true;
      }
    }

    return true;
  }

  /**
   * Description
   */

  flatten(): Array<[string, HoistManifest]> {
    let flatTree = [];

    //
    this.aliases.clear();

    // remove ignored modules from the tree
    for (let [key, info] of this.tree.entries()) {
      let ref = info.pkg.reference;
      invariant(ref, "expected reference");
      if (ref.ignore) this.tree.delete(key);
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
   * Description
   */

  init(): Array<[string, HoistManifest]> {
    this.hoist();
    return this.flatten();
  }
}
