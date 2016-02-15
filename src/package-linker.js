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

    await this.linkModules(pkg, dir);
    await this.linkBinDependencies(pkg, dir);
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

  async linkBinDependencies(pkg: Manifest, dir: string): Promise<void> {
    let ref = pkg.reference;
    invariant(ref, "Package reference is missing");

    let remote = pkg.remote;
    invariant(remote, "Package remote is missing");

    // get all dependencies with bin scripts
    let deps = [];
    for (let pattern of ref.dependencies) {
      let dep = this.resolver.getResolvedPattern(pattern);
      if (!_.isEmpty(dep.bin)) {
        deps.push({ dep, loc: this.config.generateHardModulePath(dep.reference) });
      }
    }
    if (pkg.bundleDependencies) {
      for (let depName of pkg.bundleDependencies) {
        let loc = path.join(this.config.generateHardModulePath(ref), await ref.getFolder(), depName);

        let dep = await this.config.readPackageJson(loc, remote.registry);

        if (!_.isEmpty(dep.bin)) {
          deps.push({ dep, loc });
        }
      }
    }
    if (!deps.length) return;

    // ensure our .bin file we're writing these to exists
    let binLoc = path.join(dir, ".bin");
    await fs.mkdirp(binLoc);

    // write the executables
    for (let { dep, loc } of deps) {
      await this.linkSelfDependencies(dep, loc, binLoc);
    }
  }

  async linkModules(pkg: Manifest, dir: string): Promise<void> {
    let self = this;
    invariant(pkg.reference, "Package reference is missing");

    await promise.queue(pkg.reference.dependencies, (pattern) => {
      let dep  = self.resolver.getResolvedPattern(pattern);
      let src  = self.config.generateHardModulePath(dep.reference);
      let dest = path.join(dir, dep.name);

      return fs.symlink(src, dest);
    });
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
