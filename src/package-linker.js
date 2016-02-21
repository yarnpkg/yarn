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
import type Reporter from "./reporters/_base.js";
import type Config from "./config.js";
import * as promise from "./util/promise.js";
import * as fs from "./util/fs.js";

let invariant = require("invariant");
let cmdShim   = promise.promisify(require("cmd-shim"));
let semver    = require("semver");
let path      = require("path");
let _         = require("lodash");

export default class PackageLinker {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config   = config;
  }

  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;

  async link(pkg: Manifest): Promise<void> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let dir = path.join(this.config.generateHardModulePath(ref), await ref.getFolder());
    await fs.mkdirp(dir);

    let deps = await this.linkModules(pkg, dir);
    await this.linkBinDependencies(deps, pkg, dir);
  }

  async linkSelfDependencies(pkg: Manifest, pkgLoc: string, targetBinLoc: string): Promise<void> {
    for (let scriptName in pkg.bin) {
      let scriptCmd = pkg.bin[scriptName];
      let dest      = path.join(targetBinLoc, scriptName);
      let src       = path.join(pkgLoc, scriptCmd);

      if (process.platform === "win32") {
        await cmdShim(src, dest);
      } else {
        await fs.symlink(src, dest);
        await fs.chmod(dest, "755");
      }
    }
  }

  async linkBinDependencies(deps: Array<string>, pkg: Manifest, dir: string): Promise<void> {
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

        let dep = await this.config.readPackageJson(loc, remote.registry);

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

  async linkModules(pkg: Manifest, dir: string): Promise<Array<string>> {
    let self = this;
    invariant(pkg.reference, "Package reference is missing");

    let deps = await this.linkPeerModules(pkg, dir);

    await promise.queue(pkg.reference.dependencies.concat(deps), (pattern) => {
      let dep  = self.resolver.getResolvedPattern(pattern);
      let src  = self.config.generateHardModulePath(dep.reference);
      let dest = path.join(dir, dep.name);

      return fs.symlink(src, dest);
    });

    return deps;
  }

  async linkPeerModules(pkg: Manifest, dir: string): Promise<Array<string>> {
    let deps = [];

    if (!pkg.peerDependencies) return deps;

    for (let name in pkg.peerDependencies) {
      let range = pkg.peerDependencies[name];
      let foundDep: ?{ version: string, pattern: string };

      // find a dependency in the tree above us that matches
      let request = ref.request;
      let searchPatterns: Array<string> = [];

      search: do {
        // get resolved pattern for this request
        let dep = this.resolver.getResolvedPattern(request.pattern);
        if (!dep) continue;

        //
        searchPatterns = searchPatterns.concat(dep.reference.dependencies);
      } while(request = request.parentRequest);

      // include root seed patterns last
      searchPatterns = searchPatterns.concat(this.resolver.seedPatterns);

      // find matching dep in search patterns
      let foundDep: ?{ version: string, pattern: string };
      for (let pattern of searchPatterns) {
        let dep = this.resolver.getResolvedPattern(pattern);
        if (dep && dep.name === name) {
          foundDep = { version: dep.version, pattern };
          break;
        }
      }

      // validate found peer dependency
      if (foundDep) {
        if (semver.satisfies(range, foundDep.version)) {
          deps.push(foundDep.pattern);
        } else {
          this.reporter.warn("TODO not match");
        }
      } else {
        this.reporter.warn("TODO missing dep");
      }
    }

    return deps;
  }

  async init(linkBins?: boolean = true): Promise<void> {
    let self = this;
    let pkgs = this.resolver.getManifests();
    let tick = this.reporter.progress(pkgs.length);

    await promise.queue(pkgs, (pkg) => {
      return self.link(pkg, linkBins).then(function () {
        tick(pkg.name);
      });
    });
  }
}
