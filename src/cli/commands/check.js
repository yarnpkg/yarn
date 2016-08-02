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
import { Install } from "./install.js";
import Lockfile from "../../lockfile/index.js";
import * as constants from "../../constants.js";
import * as fs from "../../util/fs.js";
import * as util from "../../util/misc.js";

let semver = require("semver");
let chalk = require("chalk");
let path = require("path");

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

  function humaniseLocation(loc: string): Array<string> {
    let relative = path.relative(path.join(config.cwd, "node_modules"), loc);
    let parts  = relative.split(new RegExp(`${path.sep}node_modules${path.sep}`, "g"));
    return parts;
  }

  let warningCount = 0;
  let errCount = 0;
  function reportError(msg) {
    reporter.error(msg);
    errCount++;
  }

  // get patterns that are installed when running `kpm install`
  let [depRequests, rawPatterns] = await install.fetchRequestFromCwd();

  // check if patterns exist in lockfile
  for (let pattern of rawPatterns) {
    if (!lockfile.getLocked(pattern)) {
      reportError(`Lockfile does not contain pattern: ${pattern}`);
    }
  }

  if (flags.quickSloppy) {
    // in sloppy mode we don't resolve dependencies, we just check a hash of the lockfile
    // against one that is created when we run `kpm install`
    let integrityLoc = path.join(config.cwd, "node_modules", constants.INTEGRITY_FILENAME);

    if (await fs.exists(integrityLoc)) {
      let actual = await fs.readFile(integrityLoc);
      let expected = util.hash(lockfile.source);

      if (actual.trim() !== expected) {
        reportError(`Expected an integrity hash of ${expected} but got ${actual}`);
      }
    } else {
      reportError("Couldn't find an integrity hash file");
    }
  } else {
    // seed resolver
    await install.resolver.init(depRequests);

    // check if any of the node_modules are out of sync
    let res = await install.linker.getFlatHoistedTree(rawPatterns);
    for (let [loc, { originalKey }] of res) {
      let parts = humaniseLocation(loc);

      // grey out hoisted portions of key
      let human = originalKey;
      let hoistedParts = parts.slice();
      let hoistedKey = parts.join("#");
      if (human !== hoistedKey) {
        let humanParts = human.split("#");

        for (let i = 0; i < humanParts.length; i++) {
          let humanPart = humanParts[i];

          if (hoistedParts[0] === humanPart) {
            hoistedParts.shift();

            if (i < humanParts.length - 1) {
              humanParts[i] += "#";
            }
          } else {
            humanParts[i] = chalk.dim(`${humanPart}#`);
          }
        }

        human = humanParts.join("");
      }

      let pkgLoc = path.join(loc, "package.json");
      if (!(await fs.exists(loc)) || !(await fs.exists(pkgLoc))) {
        reportError(`${human} not installed`);
      }

      let pkg = await fs.readJson(pkgLoc);

      let deps = Object.assign({}, pkg.dependencies, pkg.peerDependencies);

      for (let name in deps) {
        let range = deps[name];
        if (!semver.validRange(range)) continue; // exotic

        let subHuman = `${human}#${name}@${range}`;

        // find the package that this will resolve to, factoring in hoisting
        let possibles = [];
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

          possibles.push(myDepPkgLoc);
        }
        while (possibles.length) {
          let myDepPkgLoc = possibles.shift();
          if (await fs.exists(myDepPkgLoc)) {
            depPkgLoc = myDepPkgLoc;
            break;
          }
        }
        if (!depPkgLoc) {
          // we'll hit the module not install error above when this module is hit
          continue;
        }

        //
        let depPkg = await fs.readJson(depPkgLoc);
        let foundHuman = `${humaniseLocation(path.dirname(depPkgLoc)).join("#")}@${depPkg.version}`;
        if (!semver.satisfies(depPkg.version, range)) {
          // module isn't correct semver
          reportError(`${subHuman} doesn't satisfy found match of ${foundHuman}`);
          continue;
        }

        // check for modules above us that this could be deduped to
        for (let loc of possibles) {
          if (!await fs.exists(loc)) continue;

          let pkg = await fs.readJson(loc);
          if (pkg.version === depPkg.version ||
             (semver.satisfies(pkg.version, range) && semver.gt(pkg.version, depPkg.version))) {
            reporter.warn(
              `${subHuman} could be deduped from ${pkg.version} to ` +
              `${humaniseLocation(path.dirname(loc)).join("#")}@${pkg.version}`
            );
            warningCount++;
          }
          break;
        }
      }
    }
  }

  if (warningCount > 1) {
    reporter.info(`Found ${warningCount} warnings`);
  }

  if (errCount > 0) {
    if (errCount > 1) reporter.info(`Found ${errCount} errors`);
    return Promise.reject();
  } else {
    reporter.success("Folder in sync");
  }
}
