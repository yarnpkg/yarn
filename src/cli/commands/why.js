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
import { MessageError } from "../../errors.js";
import * as fs from "../../util/fs.js";

let emoji = require("node-emoji");
let path  = require("path");

async function cleanQuery(query: string): Promise<string> {
  // if a location was passed then turn it into a hash query
  if (path.isAbsolute(query) && await fs.exists(query)) {
    // absolute path
    query = path.relative(config.cwd, query);
  }

  // remove references to node_modules with hashes
  query = query.replace(/([\\/]|^)node_modules[\\/]/g, "#");

  // remove trailing hashes
  query = query.replace(/^#+/g, "");

  // remove path after last hash
  query = query.replace(/[\\/](.*?)$/g, "");

  return query;
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  let query = await cleanQuery(args[0]);

  reporter.step(1, 3, `Why do we have the module ${query}?`, emoji.get("thinking_face"));

  // init
  reporter.step(2, 3, "Initialising dependency graph", emoji.get("truck"));
  let lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
    silent: true,
    strictIfPresent: true
  });
  let install = new Install("ls", flags, args, config, reporter, lockfile);
  let [depRequests, patterns] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests);
  let hoisted = await install.linker.initCopyModules(patterns);

  // finding
  reporter.step(3, 3, "Finding dependency", emoji.get("mag"));

  let match;
  for (let [, info] of hoisted) {
    if (info.key === query || info.hoistedFrom.indexOf(query) >= 0) {
      match = info;
      break;
    }
  }

  if (match) {
    // this dependency is the result of deduping these modules

    // this dependency has been hoisted to a higher level

    // this dependency was specified as transitive for these modules

    // this dependency is a transitive dependency of these root modules in your project

    // this dependency was specified in your root manifest

    // file size of this dependency without any dependencies

    // file size of this dependency including dependencies that aren't shared

    // shared transitive dependencies
  } else {
    reporter.error("We couldn't find a match");
  }
}
