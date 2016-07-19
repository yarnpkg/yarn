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

import type { Reporter } from "../../reporters/index.js";
import type Config from "../../config.js";
import Lockfile from "../../lockfile/index.js";
import { Install } from "./install.js";
import { MessageError } from "../../errors.js";
import { stringify } from "../../util/misc.js";
import { NoopReporter } from "../../reporters/index.js";
import * as fs from "../../util/fs.js";

let path = require("path");

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  if (!args.length) {
    throw new MessageError("Expected one or more arguments");
  }

  let totalSteps = args.length + 2;
  let step = 0;

  async function runInstall() {
    let lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {});
    let install = new Install("uninstall", flags, [], config, new NoopReporter, lockfile);
    await install.init();
    return install;
  }

  // load package.json
  let json = {};
  let jsonLoc = path.join(config.cwd, "package.json");
  if (await fs.exists(jsonLoc)) {
    json = await fs.readJson(jsonLoc);
  }

  // install all modules to ensure we have a consistent state
  reporter.step(++step, totalSteps, "Installing modules");
  let install = await runInstall();

  // remove
  for (let name of args) {
    let loc = path.join(config.cwd, "node_modules", name);
    let range;
    reporter.step(++step, totalSteps, `Removing module ${name}`);

    // remove bins
    let pkg = await config.readManifest(loc);
    for (let binName in pkg.bin) {
      await fs.unlink(path.join(config.modulesFolder, "node_modules", ".bin", binName));
    }

    // remove from `package.json`
    for (let type of ["devDependencies", "dependencies", "optionalDependencies"]) {
      let deps = json[type];
      if (deps) {
        range = deps[name];
        delete deps[name];
      }
    }

    // remove entire package
    let locs = [];
    if (range) {
      // add all transitive dependencies locations
      addSub(`${name}@${range}`);

      function addSub(pattern) {
        let pkg = install.resolver.getResolvedPattern(pattern);
        if (!pkg) return; // TODO could possibly throw an error?

        locs.push(config.generateHardModulePath(pkg.reference));

        for (let key in pkg.dependencies) {
          addSub(`${key}@${pkg.dependencies[key]}`);
        }
      }
    } else {
      // doesn't look like this was in package.json so we don't have a pattern to seed
      // the search
      locs.push(loc);
    }

    for (let loc of locs) {
      await fs.unlink(loc);
    }
  }

  // save package.json
  await fs.writeFile(jsonLoc, stringify(json) + "\n");

  // reinstall so we can get the updated lockfile
  reporter.step(++step, totalSteps, "Regenerating lockfile and installing missing dependencies");
  await runInstall();

  //
  reporter.success("Successfully uninstalled packages.");
}
