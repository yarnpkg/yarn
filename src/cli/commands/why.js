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
import * as fs from "../../util/fs.js";

export let requireLockfile = true;

let invariant = require("invariant");
let emoji     = require("node-emoji");
let path      = require("path");

async function cleanQuery(config: Config, query: string): Promise<string> {
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
  let query = await cleanQuery(config, args[0]);

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
  let hoisted = await install.linker.getFlatHoistedTree(patterns);

  // finding
  reporter.step(3, 3, "Finding dependency", emoji.get("mag"));

  let match;
  for (let [, info] of hoisted) {
    if (info.key === query || info.previousKeys.indexOf(query) >= 0) {
      match = info;
      break;
    }
  }

  if (!match) {
    reporter.error("We couldn't find a match!");
    return;
  }

  let matchRef = match.pkg.reference;
  invariant(matchRef, "expected reference");

  let matchPatterns = matchRef.patterns;
  let matchRequests = matchRef.requests;

  let reasons = [];

  // reason: dependency of these modules
  for (let request of matchRequests) {
    let parentRequest = request.parentRequest;
    if (!parentRequest) continue;

    let dependent = install.resolver.getResolvedPattern(parentRequest.pattern);
    if (!dependent) continue;

    let chain = [];

    let delegator = parentRequest;
    do {
      chain.push(install.resolver.getStrictResolvedPattern(delegator.pattern).name);
    } while (delegator = delegator.parentRequest);

    reasons.push(`depended on by ${chain.reverse().join("#")}`);
  }

  // reason: exists in manifest
  let rootType;
  for (let pattern of matchPatterns) {
    rootType = install.rootPatternsToOrigin[pattern];
    if (rootType) reasons.push(`Specified in ${rootType}`);
  }

  // reason:
  if (query === match.originalKey) {
    reporter.info(`Has been hoisted to ${match.key}`);
  }

  // reason: this is hoisted from these modules
  for (let pattern of match.previousKeys) {
    if (pattern !== match.key) {
      reasons.push(`hoisted from ${pattern}`);
    }
  }

  //
  if (reasons.length === 1) {
    reporter.info(`This module exists because it's ${reasons[0]}`);
  } else if (reasons.length > 1) {
    reporter.info("Reasons this module exists");
    reporter.list("reasons", reasons);
  } else {
    reporter.error("We don't know why this module exists");
  }

  // stats: file size of this dependency without any dependencies
  reporter.info("Disk size without dependencies: 0MB");

  // stats: file size of this dependency including dependencies that aren't shared
  reporter.info("Disk size with unique dependencies: 0MB");

  // stats: file size of this dependency including dependencies
  reporter.info("Disk size with transitive dependencies: 0MB");

  // stats: shared transitive dependencies
  reporter.info("Amount of shared dependencies: 0");
}
