/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import * as reporters from "kreporters";
import Lockfile from "../../src/lockfile/index.js";
import { Install } from "../../src/cli/commands/install.js";
import Config from "../../src/config.js";
import * as fs from "../../src/util/fs.js";

let test = require("ava");
let path = require("path");

let fixturesLoc = path.join(__dirname, "..", "fixtures", "install");

async function clean(cwd, removeLock) {
  await fs.unlink(path.join(cwd, "kpm_modules"));
  await fs.unlink(path.join(cwd, "node_modules"));
  if (removeLock) await fs.unlink(path.join(cwd, "kpm.lock"));
}

async function run(flags, args, name) {
  let lockfile = new Lockfile;
  let reporter = new reporters.NoopReporter;

  let cwd = path.join(fixturesLoc, name);

  // remove the lockfile if we create one and it didn't exist before
  let removeLock = !(await fs.exists(path.join(cwd, "kpm.lock")));

  // clean up if we weren't successful last time
  await clean(cwd);

  // create directories
  await fs.mkdirp(path.join(cwd, "kpm_modules"));
  await fs.mkdirp(path.join(cwd, "node_modules"));

  let config = new Config(reporter, { cwd });
  await config.init();

  let install = new Install("install", flags, args, config, reporter, lockfile);
  await install.init();

  // clean up
  await clean(cwd, removeLock);
}

test("root install from shrinkwrap", () => {
  return run({}, [], "root-install-with-lockfile");
});

test("root install with optional deps", () => {
  return run({}, [], "root-install-with-optional-dependency");
});

test("install with arg that has install scripts", () => {
  return run({}, ["fsevents"], "install-with-arg-and-install-scripts");
});

test("install with arg", () => {
  return run({}, ["is-online"], "install-with-arg");
});

test("install with arg that has binaries", () => {
  return run({}, ["react-native-cli"], "install-with-arg-and-bin");
});
