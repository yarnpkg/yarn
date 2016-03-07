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
import type { Reporter } from "kreporters";
import type Config from "./config.js";
import executeLifecycleScript from "./util/execute-lifecycle-script.js";
import * as promise from "./util/promise.js";

let invariant = require("invariant");
let _         = require("lodash");

export default class PackageInstallScripts {
  constructor(config: Config, resolver: PackageResolver) {
    this.resolver  = resolver;
    this.reporter  = config.reporter;
    this.config    = config;
  }

  needsPermission: boolean;
  resolver: PackageResolver;
  reporter: Reporter;
  actions: Array<string>;
  config: Config;

  getInstallCommands(pkg: Manifest) {
    let scripts = pkg.scripts;
    if (scripts) {
      return _.compact([scripts.preinstall, scripts.install, scripts.postinstall]);
    } else {
      return [];
    }
  }

  async install(cmds: Array<string>, pkg: Manifest): Promise<Array<{
    cwd: string,
    command: string,
    stdout: string,
    stderr: string
  }>> {
    let loc = this.config.generateHardModulePath(pkg.reference);
    try {
      return await executeLifecycleScript(this.config, loc, cmds, pkg);
    } catch (err) {
      err.message = `${loc}: ${err.message}`;
      throw err;
    }
  }

  async init(): Promise<void> {
    let self = this; // TODO fix babel bug
    let pkgs = this.resolver.getManifests();

    // refine packages to those with install commands
    let refinedInfos = [];
    for (let pkg of pkgs) {
      let cmds = this.getInstallCommands(pkg);
      if (!cmds.length) continue;

      let ref = pkg.reference;
      invariant(ref, "Missing package reference");

      if (this.needsPermission && !ref.hasPermission("scripts")) {
        let can = await this.reporter.question(
          `Module ${pkg.name} wants to execute the commands ${JSON.stringify(cmds)}. Do you want to accept?`
        );
        if (!can) continue;

        ref.setPermission("scripts", can);
      }

      refinedInfos.push({ pkg, cmds });
    }
    if (!refinedInfos.length) return;

    let tick = this.reporter.progress(refinedInfos.length);

    await promise.queue(refinedInfos, ({ pkg, cmds }) => {
      return self.install(cmds, pkg).then(function () {
        tick(pkg.name);
      });
    });
  }
}
