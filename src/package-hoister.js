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
    this.tree = Object.create(null);

    this.unflattenedKeys = new Set;
    this.subPairs = new Map;

    this.aliases = Object.create(null);
  }

  resolver: PackageResolver;
  config: Config;

  zippedTree: Array<HoistPair>;
  aliases: { [key: string]: string };
  tree: { [key: string]: HoistManifest };
  unflattenedKeys: Set<string>;
  subPairs: Map<HoistManifest, Set<HoistPair>>;

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
    while (alias = this.aliases[key]) {
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
      let check = this.tree[checkKey];
      if (check && check.loc === loc) {
        // we have a compatible module above us, we should mark the current
        // module key as restricted and continue on
        let finalKey = this.implodeKey(ownParts.concat(pkg.name));
        this.unflattenedKeys.add(finalKey);
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
    this.tree[key] = info;
    this.unflattenedKeys.add(key);

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

  getNewParts(key: string, info: HoistManifest, parts: Array<string>): ?{
    parts: Array<string>;
    existing: ?HoistManifest;
  } {
    let stepUp = false;
    let stack = []; // stack of removed parts

    // remove redundant parts that wont collide
    let name = parts.pop();
    while (parts.length) {
      let checkParts = parts.concat(name);
      let checkKey   = this.implodeKey(checkParts);

      //
      let existing = this.tree[checkKey];
      if (existing) {
        if (existing.loc === info.loc) {
          return;
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

    // we need to special case when we attempt to hoist to the top level as the `existing` logic
    // wont be hit in the above `while` loop and we could conflict
    let existing = this.tree[this.implodeKey(parts)];
    if (existing && existing.loc !== info.loc) {
      stepUp = true;
    }

    // sometimes we need to step up to a parent module to install ourselves
    while (stepUp && stack.length) {
      parts.pop(); // remove `name`
      parts.push(stack.pop(), name);

      console.log("stepping up");

      if (this.unflattenedKeys.has(this.implodeKey(parts))) {
        // TODO? what if all the keys are reserved
      } else {
        stepUp = false;
      }
    }

    return { parts, existing, stack };
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

  hoist() {
    for (let i = 0; i < this.zippedTree.length; i++) {
      let pair: HoistPair = this.zippedTree[i];
      let [key, info] = pair;

      let rawParts = this.explodeKey(key);

      // nothing to hoist, already top level
      if (rawParts.length === 1) continue;

      // remove this item from the `tree` map so we can ignore it
      delete this.tree[key];

      //
      let newParts = this.getNewParts(key, info, rawParts);
      if (!newParts) continue;
      let { parts, existing, stack } = newParts;

      // update to the new key
      let oldKey = key;
      let newKey = this.implodeKey(parts);
      if (oldKey === newKey) {
        this.setKey(info, pair, oldKey);
        continue;
      }

      //
      this.declareRename(info, existing, parts, stack, pair);
      this.setKey(info, pair, newKey);
      this.updateTransitiveKeys(info, oldKey, newKey);
      console.log("===================");
    }
  }

  /**
   * Description
   */

  declareRename(
    info: HoistManifest,
    existing: ?HoistManifest,
    parts: Array<string>,
    stack: Array<string>,
    pair: HoistPair
  ) {
    if (existing && existing !== info) {
      this.subPairs.set(info, new Set([
        ...this.subPairs.get(existing) || [],
        ...this.subPairs.get(info) || []
      ]));
    }

    //
    let newParentParts = parts.slice(0, -1);
    let newParentKey = this.implodeKey(newParentParts);
    if (newParentKey) {
      let parent = this.tree[newParentKey];
      invariant(parent, `couldn't find parent ${newParentKey}`);

      //parent.requireReachable.add(info);

      let pairs = this.subPairs.get(parent);
      if (pairs) {
        pairs.add(pair);
      }
    }

    // go down the tree from our new position reserving our name
    for (let i = 0; i < stack.length; i++) {
      let parts = stack.slice(0, i);
      if (newParentKey) parts.unshift(newParentKey);
      parts.push(info.pkg.name);

      let key = this.implodeKey(parts);
      console.log("blacklist", key);
      this.unflattenedKeys.add(key);
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

      let subInfo = this.tree[subKey];
      if (!subInfo) continue;

      let newSubKey = subKey.replace(new RegExp(`^${oldKey}#`), `${newKey}#`);
      if (newSubKey === subKey) continue;

      // restrict use of the new key in case we hoist it further from here
      this.unflattenedKeys.add(newSubKey);

      // update references
      this.setKey(subInfo, subPair, newSubKey);
      delete this.tree[subKey];
    }
  }

  /**
   * Description
   */

  setKey(info: HoistManifest, pair: HoistPair, newKey: string) {
    let oldKey = info.key;

    if (oldKey !== newKey) {
      console.log("rename", oldKey, "->", newKey);
      this.aliases[oldKey] = newKey;
      info.key = newKey;
      pair[0] = newKey;
    }

    this.tree[newKey] = info;
  }

  /**
   * Description
   */

  isUnreachableDependency(info: HoistManifest, parts: Array<string>): boolean {
    while (true) {
      let checkKey = this.implodeKey(parts.concat(info.pkg.name));
      let existing = this.tree[checkKey];

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
    for (let key in this.tree) {
      let info = this.tree[key];

      // should we ignore this module from linking?
      let ref = info.pkg.reference;
      invariant(ref, "expected reference");
      if (ref.ignore) continue;

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
