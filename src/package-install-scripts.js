/* @flow */

import type { PackageInfo } from "./types";
import type PackageResolver from "./package-resolver";
import type Reporter from "./reporters/_base";
import type Config from "./config";
import executeLifecycleScript from "./util/execute-lifecycle-script";
import * as promise from "./util/promise";

let invariant = require("invariant");
let _         = require("lodash");

export default class PackageInstallScripts {
  constructor(config: Config, reporter: Reporter, resolver: PackageResolver) {
    this.resolver  = resolver;
    this.reporter  = reporter;
    this.config    = config;
  }

  needsPermission: boolean;
  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;
  actions: Array<string>;

  getInstallCommands(pkg: PackageInfo) {
    let scripts = pkg.scripts;
    if (scripts) {
      return _.compact([scripts.preinstall, scripts.install, scripts.postinstall]);
    } else {
      return [];
    }
  }

  async install(cmds: Array<string>, pkg: PackageInfo): Promise<Array<{
    cwd: string,
    command: string,
    stdout: string,
    stderr: string
  }>> {
    let loc = this.config.generateHardModulePath(pkg.reference);
    return executeLifecycleScript(loc, cmds, pkg);
  }

  async init(): Promise<void> {
    let self = this; // TODO fix babel bug
    let pkgs = this.resolver.getPackageInfos();

    // refine packages to those with install commands
    let refinedInfos = [];
    for (let pkg of pkgs) {
      let cmds = this.getInstallCommands(pkg);
      if (!cmds.length) continue;

      let ref = pkg.reference;
      invariant(ref, "Missing package reference");

      if (this.needsPermission && !ref.hasPermission("scripts")) {
        let can = await this.reporter.question(`Module ${pkg.name} wants to execute the commands ${JSON.stringify(cmds)}. Do you want to accept?`);
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
