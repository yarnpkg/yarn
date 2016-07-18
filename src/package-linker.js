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

import type { Manifest } from "./types.js";
import type PackageResolver from "./package-resolver.js";
import type { Reporter } from "./reporters/index.js";
import type Config from "./config.js";
import * as promise from "./util/promise.js";
import { entries } from "./util/misc.js";
import * as fs from "./util/fs.js";

let invariant = require("invariant");
let cmdShim   = promise.promisify(require("cmd-shim"));
let semver    = require("semver");
let path      = require("path");
let _         = require("lodash");

type DependencyPairs = Array<{
  dep: Manifest,
  loc: string
}>;

export default class PackageLinker {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config   = config;
  }

  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;

  async linkSelfDependencies(pkg: Manifest, pkgLoc: string, targetBinLoc: string): Promise<void> {
    targetBinLoc = await fs.realpath(targetBinLoc);
    pkgLoc = await fs.realpath(pkgLoc);
    for (let [scriptName, scriptCmd] of entries(pkg.bin)) {
      let dest = path.join(targetBinLoc, scriptName);
      let src  = path.join(pkgLoc, scriptCmd);

      if (process.platform === "win32") {
        await cmdShim(src, dest);
      } else {
        await fs.symlink(src, dest);
        await fs.chmod(dest, "755");
      }
    }
  }

  async linkBinDependencies(deps: DependencyPairs, pkg: Manifest, dir: string): Promise<void> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let remote = pkg.remote;
    invariant(remote, "Package remote is missing");

    // link up `bin scripts` in `dependencies`
    for (let pattern of ref.dependencies) {
      let dep = this.resolver.getResolvedPattern(pattern);
      if (!_.isEmpty(dep.bin)) {
        deps.push({ dep, loc: this.config.generateHardModulePath(dep.reference) });
      }
    }

    // link up the `bin` scripts in bundled dependencies
    if (pkg.bundleDependencies) {
      for (let depName of pkg.bundleDependencies) {
        let loc = path.join(this.config.generateHardModulePath(ref), await ref.getFolder(), depName);

        let dep = await this.config.readManifest(loc, remote.registry);

        if (!_.isEmpty(dep.bin)) {
          deps.push({ dep, loc });
        }
      }
    }

    // no deps to link
    if (!deps.length) return;

    // ensure our .bin file we're writing these to exists
    let binLoc = path.join(dir, ".bin");
    await fs.mkdirp(binLoc);

    // write the executables
    for (let { dep, loc } of deps) {
      await this.linkSelfDependencies(dep, loc, binLoc);
    }
  }

  async initCopyModules(patterns: Array<string>): Promise<Array<[string, Manifest]>> {
    // we need to zip up the tree as we we're using it as a hash map and will be actively
    // removing and deleting keys during enumeration
    let zippedTree = [];
    let tree = Object.create(null);
    let self = this;

    let unflattenedKeys = new Set;
    let subPairs = new Map;

    //
    function add(pattern, parentParts) {
      if (parentParts.length >= 100) {
        throw new Error("cause we're in too deep");
      }

      let pkg = self.resolver.getResolvedPattern(pattern);
      let loc = self.config.generateHardModulePath(pkg.reference);

      //
      let ownParts = parentParts.slice();
      for (let i = ownParts.length; i >= 0; i--) {
        let checkParts = ownParts.slice(0, i).concat(pkg.name);
        let checkKey = checkParts.join("#");
        let check = tree[checkKey];
        if (check && check.loc === loc) {
          // we have a compatible module above us, we should mark the current
          // module key as restricted and continue on
          unflattenedKeys.add(ownParts.concat(pkg.name).join("#"));
          return [];
        }
      }
      ownParts.push(pkg.name);

      let key = ownParts.join("#");
      let info = {
        loc,
        pkg,
      };
      let pair = [key, info];

      zippedTree.push(pair);
      tree[key] = info;
      unflattenedKeys.add(key);

      let results = [];

      // add dependencies
      for (let depPattern of pkg.reference.dependencies) {
        results = results.concat(add(depPattern, ownParts));
      }

      subPairs.set(info, results.slice());

      results.push(pair);

      return results;
    }

    for (let pattern of this.resolver.dedupePatterns(patterns)) {
      add(pattern, []);
    }

    // hoist tree
    hoist: for (let i = 0; i < zippedTree.length; i++) {
      let pair = zippedTree[i];
      let [key, info] = pair;

      let stepUp = false;
      let parts = key.split("#");
      let stack = []; // stack of removed parts

      // remove this item from the `tree` map so we can ignore it
      delete tree[key];

      // remove redundant parts that wont collide
      let name = parts.pop();
      while (parts.length) {
        let checkKey = parts.concat(name).join("#");

        //
        let existing = tree[checkKey];
        if (existing) {
          if (existing.loc === info.loc) {
            continue hoist;
          } else {
            break;
          }
        }

        // check if we're trying to hoist ourselves to a previously unflattened module key,
        // this will result in a conflict and we'll need to move ourselves up
        if (key !== checkKey && unflattenedKeys.has(checkKey)) {
          stepUp = true;
          break;
        }

        stack.push(parts.pop());
      }

      //
      parts.push(name);

      // we need to special case when we attempt to hoist to the top level as the `existing` logic
      // wont be hit in the above `while` loop and we could conflict
      let existing = tree[parts.join("#")];
      if (existing && existing.loc !== info.loc) {
        stepUp = true;
      }

      // sometimes we need to step up to a parent module to install ourselves
      if (stepUp) {
        parts.pop();
        parts.push(stack.pop(), name);
      }

      // update to the new key
      let oldKey = key;
      let newKey = parts.join("#");
      tree[newKey] = info;
      pair[0] = newKey;

      // go through and update all transitive dependencies and update their keys to the new
      // hoisting position
      let pairs = subPairs.get(info) || [];
      for (let pair of pairs) {
        let [subKey] = pair;
        if (subKey === newKey) continue;

        let newSubKey = subKey.replace(new RegExp(`^${oldKey}#`), `${newKey}#`);
        if (newSubKey === subKey) continue;

        // restrict use of the new key in case we hoist it further from here
        unflattenedKeys.add(newSubKey);

        // update references
        tree[newSubKey] = tree[subKey];
        pair[0] = newSubKey;
        delete tree[subKey];
      }
    }

    //
    let flatTree = [];
    for (let key in tree) {
      let info = tree[key];

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

  async copyModules(patterns: Array<string>): Promise<void> {
    let flatTree = await this.initCopyModules(patterns);

    // sorted tree makes file creation and copying not to interfere with each other
    flatTree = flatTree.sort((dep1, dep2) => {
      return dep1[0].localeCompare(dep2[0]);
    });

    //
    let tickCopyModule = this.reporter.progress(flatTree.length);
    await promise.queue(flatTree, async function ([dest, { pkg, loc: src }]) {
      pkg.reference.setLocation(dest);
      await fs.mkdirp(dest);

      let fresh = await fs.copy(src, dest);
      pkg.reference.setFresh(fresh);

      tickCopyModule(dest);
    }, 4);

    //
    let tickBin = this.reporter.progress(flatTree.length);
    await promise.queue(flatTree, async ([dest, { pkg }]) => {
      let binLoc = path.join(dest, "node_modules");
      await this.linkBinDependencies([], pkg, binLoc);
      tickBin(dest);
    }, 4);
  }

  async resolvePeerModules(pkg: Manifest): Promise<DependencyPairs> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let deps = [];

    if (!pkg.peerDependencies) return deps;

    for (let name in pkg.peerDependencies) {
      let range = pkg.peerDependencies[name];

      // find a dependency in the tree above us that matches
      let searchPatterns: Array<string> = [];
      for (let request of ref.requests) {
        do {
          // get resolved pattern for this request
          let dep = this.resolver.getResolvedPattern(request.pattern);
          if (!dep) continue;

          //
          searchPatterns = searchPatterns.concat(dep.reference.dependencies);
        } while (request = request.parentRequest);
      }

      // include root seed patterns last
      searchPatterns = searchPatterns.concat(this.resolver.seedPatterns);

      // find matching dep in search patterns
      let foundDep: ?{ pattern: string, version: string, package: Manifest };
      for (let pattern of searchPatterns) {
        let dep = this.resolver.getResolvedPattern(pattern);
        if (dep && dep.name === name) {
          foundDep = { pattern, version: dep.version, package: dep };
          break;
        }
      }

      // validate found peer dependency
      if (foundDep) {
        if (range === "*" || semver.satisfies(range, foundDep.version)) {
          deps.push({
            pattern: foundDep.pattern,
            dep: foundDep.package,
            loc: this.config.generateHardModulePath(foundDep.package.reference)
          });
        } else {
          this.reporter.warn("TODO not match");
        }
      } else {
        this.reporter.warn("TODO missing dep");
      }
    }

    return deps;
  }

  async init(patterns: Array<string>): Promise<void> {
    await this.copyModules(patterns);
    await this.saveAll(patterns);
  }

  async save(pattern: string): Promise<void> {
    let resolved = this.resolver.getResolvedPattern(pattern);
    invariant(resolved, `Couldn't find resolved name/version for ${pattern}`);

    let ref = resolved.reference;
    invariant(ref, "Missing reference");

    //
    let src = this.config.generateHardModulePath(ref);

    // link bins
    if (!_.isEmpty(resolved.bin)) {
      let binLoc = path.join(this.config.modulesFolder, ".bin");
      await fs.mkdirp(binLoc);
      await this.linkSelfDependencies(resolved, src, binLoc);
    }
  }

  async saveAll(deps: Array<string>): Promise<void> {
    deps = this.resolver.dedupePatterns(deps);
    let self = this;
    await promise.queue(deps, (dep) => self.save(dep));
  }
}
