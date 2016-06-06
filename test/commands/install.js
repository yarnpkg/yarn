/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import * as reporters from "kreporters";
import * as constants from "../../src/constants.js";
import { default as Lockfile, parse } from "../../src/lockfile/index.js";
import { Install } from "../../src/cli/commands/install.js";
import Config from "../../src/config.js";
import * as fs from "../../src/util/fs.js";
import assert from "assert";

let test = require("ava");
let path = require("path");

let fixturesLoc = path.join(__dirname, "..", "fixtures", "install");

async function clean(cwd, removeLock) {
  await fs.unlink(path.join(cwd, constants.MODULE_CACHE_DIRECTORY));
  await fs.unlink(path.join(cwd, "node_modules"));
  if (removeLock) await fs.unlink(path.join(cwd, constants.LOCKFILE_FILENAME));
}

async function createLockfile(dir, strict, save) {
  let lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
  let lockfile;

  if (await fs.exists(lockfileLoc)) {
    let rawLockfile = await fs.readFile(lockfileLoc);
    lockfile = parse(rawLockfile);
  }

  return new Lockfile(lockfile, strict, save);
}

async function run(flags, args, name, checkInstalled) {
  let reporter = new reporters.NoopReporter;

  let cwd = path.join(fixturesLoc, name);

  // remove the lockfile if we create one and it didn't exist before
  let removeLock = !(await fs.exists(path.join(cwd, constants.LOCKFILE_FILENAME)));
  let lockfile = await createLockfile(cwd, flags.strict, flags.save);

  // clean up if we weren't successful last time
  await clean(cwd);

  // create directories
  await fs.mkdirp(path.join(cwd, constants.MODULE_CACHE_DIRECTORY));
  await fs.mkdirp(path.join(cwd, "node_modules"));

  let config = new Config(reporter, { cwd });
  await config.init();

  let install = new Install("install", flags, args, config, reporter, lockfile);
  await install.init();

  if (checkInstalled) {
    await checkInstalled(cwd);
  }

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

test("install with --save and offline mirror", () => {
  let mirrorPath = "mirror-for-offline";
  return run({save: true}, ["is-array@1.0.1"], "install-with-save-offline-mirror", async (cwd) => {

    let allFiles = await fs.walk(cwd);

    assert(allFiles.findIndex((file) => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) !== -1);

    let rawLockfile = await fs.readFile(path.join(cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert(lockfile["is-array@1.0.1"]["resolved"] ===
      "is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a");

    await fs.unlink(path.join(cwd, mirrorPath));
    await fs.unlink(path.join(cwd, "package.json"));
    return allFiles;
  });
});

test("install with --save and without offline mirror", () => {
  let mirrorPath = "mirror-for-offline";
  return run({save: true}, ["is-array@1.0.1"], "install-with-save-no-offline-mirror", async (cwd) => {

    let allFiles = await fs.walk(cwd);

    assert(allFiles.findIndex((file) => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) === -1);

    let rawLockfile = await fs.readFile(path.join(cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert(lockfile["is-array@1.0.1"]["resolved"] ===
      "https://registry.npmjs.org/is-array/-/is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a");

    await fs.unlink(path.join(cwd, mirrorPath));
    await fs.unlink(path.join(cwd, "package.json"));
    return allFiles;
  });
});

test("install from offline mirror", () => {
  return run({}, [], "install-from-offline-mirror", async (cwd) => {

    let allFiles = await fs.walk(cwd);

    assert(allFiles.findIndex((file) => {
      return file.relative === "node_modules/fake-fbkpm-dependency/package.json";
    }) !== -1);

    return allFiles;
  });
});
