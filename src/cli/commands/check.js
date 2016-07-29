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
import { MessageError } from "../../errors.js";
import { Install } from "./install.js";
import Lockfile from "../../lockfile/index.js";
import * as constants from "../../constants.js";
import * as fs from "../../util/fs.js";
import * as util from "../../util/misc.js";

let semver = require("semver");
let path   = require("path");

export let requireLockfile = true;
export let noArguments = true;

export function setFlags(commander: Object) {
  commander.option("--quick-sloppy");
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  let lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
    silent: true,
    strict: true
  });

  let install = new Install("update", flags, args, config, reporter, lockfile, true);

  let errCount = 0;

  // get patterns that are installed when running `kpm install`
  let [depRequests, rawPatterns] = await install.fetchRequestFromCwd();

  // check if patterns exist in lockfile
  for (let pattern of rawPatterns) {
    if (!lockfile.getLocked(pattern)) {
      reporter.error(`Lockfile does not contain pattern: ${pattern}`);
      errCount++;
    }
  }

  function humaniseLocation(loc: string): Array<string> {
    let relative = path.relative(path.join(config.cwd, "node_modules"), loc);
    let parts    = relative.split(new RegExp(`${path.sep}node_modules${path.sep}`, "g"));
    return parts;
  }

  if (flags.quickSloppy) {
    // in sloppy mode we don't resolve dependencies, we just check a hash of the lockfile
    // against one that is created when we run `kpm install`
    let integrityLoc = path.join(config.cwd, "node_modules", constants.INTEGRITY_FILENAME);

    if (await fs.exists(integrityLoc)) {
      let actual = await fs.readFile(integrityLoc);
      let expected = util.hash(lockfile.source);

      if (actual.trim() !== expected) {
        reporter.error(`Expected an integrity hash of ${expected} but got ${actual}`);
        errCount++;
      }
    } else {
      reporter.error("Couldn't find an integrity hash file");
      errCount++;
    }
  } else {
    // seed resolver
    await install.resolver.init(depRequests);

    // check if any of the node_modules are out of sync
    let res = await install.linker.getFlatHoistedTree(rawPatterns);
    for (let [loc, { originalKey }] of res) {
      let parts = humaniseLocation(loc);

      let pkgLoc = path.join(loc, "package.json");
      if (!(await fs.exists(loc)) || !(await fs.exists(pkgLoc))) {
        reporter.error(`Module ${originalKey} not installed`);
        errCount++;
      }

      let pkg = await fs.readJson(pkgLoc);

      let deps = Object.assign({}, pkg.dependencies, pkg.peerDependencies);

      for (let name in deps) {
        let range = deps[name];
        if (!semver.validRange(range)) continue; // exotic

        // find the package that this will resolve to, factoring in hoisting
        let depPkgLoc;
        for (let i = parts.length; i >= 0; i--) {
          let myParts = parts.slice(0, i).concat(name);

          // build package.json location for this position
          let myDepPkgLoc = path.join(
            config.cwd,
            "node_modules",
            myParts.join(`${path.sep}node_modules${path.sep}`),
            "package.json"
          );

          if (await fs.exists(myDepPkgLoc)) {
            depPkgLoc = myDepPkgLoc;
            break;
          }
        }
        if (!depPkgLoc) {
          // we'll hit the module not install error above when this module is hit
          continue;
        }

        let depPkg = await fs.readJson(depPkgLoc);
        if (semver.satisfies(depPkg.version, range)) continue;

        // module isn't correct semver
        reporter.error(
          `Module ${originalKey} (hoisted to ${parts.join("#")}) depends on ${name} with the ` +
          `range ${range} but it doesn't match the installed version of ${depPkg.version} ` +
          `found at ${humaniseLocation(path.dirname(depPkgLoc)).join("#")}`
        );
        errCount++;
      }
    }
  }

  if (errCount > 0) {
    throw new MessageError(`Found ${errCount} errors`);
  }
}
