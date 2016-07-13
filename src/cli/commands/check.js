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

import type { Reporter } from "kreporters";
import type Config from "../../config.js";
import { Install } from "./install.js";
import Lockfile from "../../lockfile/index.js";
import { MessageError } from "../../errors.js";
import * as constants from "../../constants.js";
import * as fs from "../../util/fs.js";
import * as util from "../../util/misc.js";

let path = require("path");

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
  if (!await fs.exists(path.join(config.cwd, constants.LOCKFILE_FILENAME))) {
    throw new MessageError("No lockfile in this directory. Run `fbkpm install` to generate one.");
  }

  let lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
    silent: true,
    strict: true
  });

  let install = new Install("update", flags, args, config, reporter, lockfile, true);

  let valid = true;

  // get patterns that are installed when running `kpm install`
  let [depRequests, rawPatterns] = await install.fetchRequestFromCwd();

  // check if patterns exist in lockfile
  for (let pattern of rawPatterns) {
    if (!lockfile.getLocked(pattern)) {
      reporter.error(`Lockfile does not contain pattern: ${pattern}`);
      valid = false;
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
        valid = false;
        reporter.error(`Expected an integrity hash of ${expected} but got ${actual}`);
      }
    } else {
      reporter.error("Couldn't find an integrity hash file");
      valid = false;
    }
  } else {
    // seed resolver
    await install.resolver.init(depRequests);

    // check if any of the node_modules are out of sync
    let res = await install.linker.initCopyModules(rawPatterns);
    for (let [loc] of res) {
      if (!(await fs.exists(loc))) {
        reporter.error(`Module not installed: ${path.relative(process.cwd(), loc)}`);
        valid = false;
      }
    }
  }

  if (valid) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}
