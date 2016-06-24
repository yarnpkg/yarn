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
import { run as uninstall } from "../../src/cli/commands/uninstall.js";
import Config from "../../src/config.js";
import * as fs from "../../src/util/fs.js";
import assert from "assert";
import semver from "semver";


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

async function run(flags, args, name, checkInstalled, beforeInstall) {
  let reporter = new reporters.NoopReporter;

  let cwd = path.join(fixturesLoc, name);

  if (beforeInstall) {
    await beforeInstall(cwd);
  }

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
    await checkInstalled(config, reporter);
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
  return run({save: true}, ["is-array@1.0.1"], "install-with-save-offline-mirror", async (config) => {

    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file) => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) !== -1);

    let rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert.equal(lockfile["is-array@1.0.1"]["resolved"],
      "is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a");

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, "package.json"));
    return allFiles;
  });
});

test("install with --save and without offline mirror", () => {
  let mirrorPath = "mirror-for-offline";
  return run({save: true}, ["is-array@1.0.1"], "install-with-save-no-offline-mirror", async (config) => {

    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file) => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) === -1);

    let rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert.equal(lockfile["is-array@1.0.1"]["resolved"],
      "https://registry.npmjs.org/is-array/-/is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a");

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, "package.json"));
    return allFiles;
  });
});

test("install from offline mirror", () => {
  return run({}, [], "install-from-offline-mirror", async (config) => {

    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file) => {
      return file.relative === "node_modules/fake-fbkpm-dependency/package.json";
    }) !== -1);

    return allFiles;
  });
});

test("install should dedupe dependencies avoiding conflicts 0", () => {
  // A@2.0.1 -> B@2.0.0
  // B@1.0.0
  // should result in B@2.0.0 not flattened
  return run({}, [], "install-should-dedupe-avoiding-conflicts-0", async (config) => {
    let rawDepBPackage = await fs.readFile(path.join(config.cwd, "node_modules/dep-b/package.json"));
    assert.equal(JSON.parse(rawDepBPackage).version, "1.0.0");

    rawDepBPackage = await fs.readFile(
      path.join(config.cwd, "node_modules/dep-a/node_modules/dep-b/package.json")
    );
    assert.equal(JSON.parse(rawDepBPackage).version, "2.0.0");
  });
});

test("install should dedupe dependencies avoiding conflicts 1", () => {
  // A@2.0.1 -> B@2.0.0
  // should result in B@2.0.0 flattened
  return run({}, [], "install-should-dedupe-avoiding-conflicts-1", async (config) => {
    let rawDepBPackage = await fs.readFile(path.join(config.cwd, "node_modules/dep-b/package.json"));
    assert.equal(JSON.parse(rawDepBPackage).version, "2.0.0");

    rawDepBPackage = await fs.readFile(path.join(config.cwd, "node_modules/dep-a/package.json"));
    assert.equal(JSON.parse(rawDepBPackage).version, "2.0.1");
  });
});

test("install should dedupe dependencies avoiding conflicts 2", () => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  // B@1 -> C@1
  // should become
  // A@2 -> B@2
  // D@1
  // B@1 -> C@1
  // C@2

  return run({}, [], "install-should-dedupe-avoiding-conflicts-2", async (config) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/node_modules/dep-b/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-c/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-d/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-b/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-b/node_modules/dep-c/package.json"))).version, "1.0.0");
  });
});

test("install should dedupe dependencies avoiding conflicts 3", () => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  //     -> C@1
  // should become
  // A@2 -> C@1
  // B@2
  // C@2
  // D@1
  return run({}, [], "install-should-dedupe-avoiding-conflicts-3", async (config) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-c/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-d/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-b/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/node_modules/dep-c/package.json"))).version, "1.0.0");
  });
});

test("install should dedupe dependencies avoiding conflicts 4", () => {
  // A@2 -> B@2 -> D@1 -> C@2
  //
  //     -> C@1

  // should become

  // A@2 -> C@1
  // C@2
  // B@2
  // D@1
  return run({}, [], "install-should-dedupe-avoiding-conflicts-4", async (config) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-c/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-d/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-b/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/node_modules/dep-c/package.json"))).version, "1.0.0");
  });
});

test("install should dedupe dependencies avoiding conflicts 5", () => {
  // A@1 -> B@1
  // C@1 -> D@1 -> A@2 -> B@2

  // should become

  // A@1
  // B@1
  // C@1
  // D@1 -> A@2
  //     -> B@2

  return run({}, [], "install-should-dedupe-avoiding-conflicts-5", async (config) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-b/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-c/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-d/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-d/node_modules/dep-a/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-d/node_modules/dep-b/package.json"))).version, "2.0.0");

  });
});

test("upgrade scenario", () => {
  // left-pad first installed 0.0.9 then updated to 1.1.0
  // files in mirror, fbkpm.lock, package.json and node_modules should reflect that

  let mirrorPath = "mirror-for-offline";

  async function clean(cwd) {
    await fs.unlink(path.join(cwd, mirrorPath));
    await fs.unlink(path.join(cwd, "fbkpm.lock"));
    await fs.unlink(path.join(cwd, "package.json"));
  }

  return run({ save: true }, ["left-pad@0.0.9"], "install-upgrade-scenario", async (config) => {
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/left-pad/package.json"))).version,
      "0.0.9"
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies,
      {"left-pad": "0.0.9"}
    );

    let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
    let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
    assert.equal(lockFileLines[0], "left-pad@0.0.9:");
    assert.equal(lockFileLines.length, 4);
    assert.notEqual(lockFileLines[3].indexOf("resolved left-pad-0.0.9.tgz"), -1);

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, "left-pad-0.0.9.tgz");

    return run({save: true}, ["left-pad@1.1.0"], "install-upgrade-scenario", async (config) => {
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/left-pad/package.json"))).version,
        "1.1.0"
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies,
        {"left-pad": "1.1.0"}
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
      let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
      assert.equal(lockFileLines[0], "left-pad@1.1.0:");
      assert.equal(lockFileLines.length, 4);
      assert.notEqual(lockFileLines[3].indexOf("resolved left-pad-1.1.0.tgz"), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 2);
      assert.equal(mirror[1].relative, "left-pad-1.1.0.tgz");

      await clean(config.cwd);
    });
  }, clean);
});

test("upgrade scenario 2 (with sub dependencies)", async () => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11
  // files in mirror, fbkpm.lock, package.json and node_modules should reflect that

  let mirrorPath = "mirror-for-offline";
  let fixture = "install-upgrade-scenario-2";
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, "fbkpm.lock.before"), path.join(cwd, "fbkpm.lock"));
  await fs.copy(path.join(cwd, "package.json.before"), path.join(cwd, "package.json"));

  return run({}, [], fixture, async (config) => {
    assert(semver.satisfies(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
      "~1.0.1")
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
      "2.0.0"
    );

    return run({save: true}, ["mime-types@2.1.11"], fixture, async (config) => {
      assert(semver.satisfies(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
        "~1.23.0"
      ));
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
        "2.1.11"
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
      let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
      assert.equal(lockFileLines[0], "mime-db@~1.23.0:");
      assert.notEqual(lockFileLines[3].indexOf("resolved mime-db-"), -1);
      assert.equal(lockFileLines[4], "mime-types@2.1.11:");
      assert.notEqual(lockFileLines[7].indexOf("resolved mime-types-2.1.11.tgz"), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 4);
      let newFilesInMirror = mirror.filter((elem) => {
        return elem.relative !== "mime-db-1.0.3.tgz" && elem.relative !== "mime-types-2.0.0.tgz";
      });

      assert.equal(newFilesInMirror.length, 2);

      await fs.unlink(newFilesInMirror[0].absolute);
      await fs.unlink(newFilesInMirror[1].absolute);

      await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
      await fs.unlink(path.join(config.cwd, "package.json"));
    });
  });
});

test("downgrade scenario", () => {
  // left-pad first installed 1.1.0 then downgraded to 0.0.9
  // files in mirror, fbkpm.lock, package.json and node_modules should reflect that

  return run({save: true}, ["left-pad@1.1.0"], "install-downgrade-scenario", async (config) => {
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/left-pad/package.json"))).version,
      "1.1.0"
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies,
      {"left-pad": "1.1.0"}
    );

    let mirrorPath = "mirror-for-offline";
    let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
    let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
    assert.equal(lockFileLines[0], "left-pad@1.1.0:");
    assert.equal(lockFileLines.length, 4);
    assert.notEqual(lockFileLines[3].indexOf("resolved left-pad-1.1.0.tgz"), -1);

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, "left-pad-1.1.0.tgz");

    return run({save: true}, ["left-pad@0.0.9"], "install-downgrade-scenario", async (config) => {
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/left-pad/package.json"))).version,
        "0.0.9"
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies,
        {"left-pad": "0.0.9"}
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
      let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
      assert.equal(lockFileLines[0], "left-pad@0.0.9:");
      assert.equal(lockFileLines.length, 4);
      assert.notEqual(lockFileLines[3].indexOf("resolved left-pad-0.0.9.tgz"), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 2);
      assert.equal(mirror[0].relative, "left-pad-0.0.9.tgz");

      await fs.unlink(path.join(config.cwd, mirrorPath));
      await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
      await fs.unlink(path.join(config.cwd, "package.json"));
    });
  });
});

test("install have a clean node_modules after lockfile update (branch switch scenario)", async () => {
  // A@1 -> B@1
  // B@2

  // after package.json/lock file update

  // A@1.2 -> B@1.2

  // (deduped)

  // A@1.2
  // B@1.2

  let fixture = "install-should-cleanup-when-package-json-changed";
  let cwd = path.join(fixturesLoc, fixture);

  await fs.copy(path.join(cwd, "fbkpm.lock.before"), path.join(cwd, "fbkpm.lock"));
  await fs.copy(path.join(cwd, "package.json.before"), path.join(cwd, "package.json"));

  return run({}, [], fixture, async (config) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-b/package.json"))).version, "2.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/node_modules/dep-b/package.json"))).version, "1.0.0");

    await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
    await fs.unlink(path.join(config.cwd, "package.json"));

    await fs.copy(path.join(cwd, "fbkpm.lock.after"), path.join(cwd, "fbkpm.lock"));
    await fs.copy(path.join(cwd, "package.json.after"), path.join(cwd, "package.json"));

    return run({}, [], fixture, async (config) => {
      assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
        "node_modules/dep-a/package.json"))).version, "1.2.0");
      assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
        "node_modules/dep-b/package.json"))).version, "1.2.0");

      await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
      await fs.unlink(path.join(config.cwd, "package.json"));
    });
  });
});


test("install have a clean node_modules after lockfile update (branch switch scenario 2)", async () => {
  // A@1 -> B@1

  // after package.json/lock file update

  // A@1.2

  let fixture = "install-should-cleanup-when-package-json-changed-2";
  let cwd = path.join(fixturesLoc, fixture);

  await fs.copy(path.join(cwd, "fbkpm.lock.before"), path.join(cwd, "fbkpm.lock"));
  await fs.copy(path.join(cwd, "package.json.before"), path.join(cwd, "package.json"));

  return run({}, [], fixture, async (config) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-a/package.json"))).version, "1.0.0");
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/dep-b/package.json"))).version, "1.0.0");

    await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
    await fs.unlink(path.join(config.cwd, "package.json"));

    await fs.copy(path.join(cwd, "fbkpm.lock.after"), path.join(cwd, "fbkpm.lock"));
    await fs.copy(path.join(cwd, "package.json.after"), path.join(cwd, "package.json"));

    return run({}, [], fixture, async (config) => {
      assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
        "node_modules/dep-a/package.json"))).version, "1.2.0");

      assert(!await fs.exists(path.join(config.cwd, "node_modules/dep-b")));

      await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
      await fs.unlink(path.join(config.cwd, "package.json"));
    });
  });
});

test("uninstall should remove dependency from package.json, fbkpm.lock and node_modules", () => {
  let mirrorPath = "mirror-for-offline";

  return run({}, [], "uninstall-should-clean", async (config, reporter) => {
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/dep-a/package.json"))).version,
      "1.0.0"
    );

    await fs.copy(path.join(config.cwd, "fbkpm.lock"), path.join(config.cwd, "fbkpm.lock.orig"));
    await fs.copy(path.join(config.cwd, "package.json"), path.join(config.cwd, "package.json.orig"));

    await uninstall(config, reporter, {}, ["dep-a"]);

    assert(!await fs.exists(path.join(config.cwd, "node_modules/dep-a")));
    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`)));

    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies,
      {}
    );

    let lockFileContent = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
    let lockFileLines = lockFileContent.split("\n").filter((line) => !!line);
    assert.equal(lockFileLines.length, 0);

    await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
    await fs.unlink(path.join(config.cwd, "package.json"));
    await fs.copy(path.join(config.cwd, "fbkpm.lock.orig"), path.join(config.cwd, "fbkpm.lock"));
    await fs.copy(path.join(config.cwd, "package.json.orig"), path.join(config.cwd, "package.json"));
    await fs.unlink(path.join(config.cwd, "fbkpm.lock.orig"));
    await fs.unlink(path.join(config.cwd, "package.json.orig"));
  });
});

test("uninstall should remove subdependencies", () => {
  // A@1 -> B@1
  // C@1

  // remove A

  // C@1

  let mirrorPath = "mirror-for-offline";

  return run({}, [], "uninstall-should-remove-subdependencies", async (config, reporter) => {
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/dep-a/package.json"))).version,
      "1.0.0"
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/dep-b/package.json"))).version,
      "1.0.0"
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/dep-c/package.json"))).version,
      "1.0.0"
    );

    await fs.copy(path.join(config.cwd, "fbkpm.lock"), path.join(config.cwd, "fbkpm.lock.orig"));
    await fs.copy(path.join(config.cwd, "package.json"), path.join(config.cwd, "package.json.orig"));

    await uninstall(config, reporter, {}, ["dep-a"]);

    assert(!await fs.exists(path.join(config.cwd, "node_modules/dep-a")));
    assert(!await fs.exists(path.join(config.cwd, "node_modules/dep-b")));
    assert(await fs.exists(path.join(config.cwd, "node_modules/dep-c")));

    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`)));
    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-b-1.0.0.tgz`)));
    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-c-1.0.0.tgz`)));

    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies,
      {"dep-c": "^1.0.0"}
    );

    let lockFileContent = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
    let lockFileLines = lockFileContent.split("\n").filter((line) => !!line);
    assert.equal(lockFileLines.length, 4);
    assert.equal(lockFileLines[0], "dep-c@^1.0.0:");

    await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
    await fs.unlink(path.join(config.cwd, "package.json"));
    await fs.copy(path.join(config.cwd, "fbkpm.lock.orig"), path.join(config.cwd, "fbkpm.lock"));
    await fs.copy(path.join(config.cwd, "package.json.orig"), path.join(config.cwd, "package.json"));
    await fs.unlink(path.join(config.cwd, "fbkpm.lock.orig"));
    await fs.unlink(path.join(config.cwd, "package.json.orig"));
  });
});

test("install --save should add missing deps to fbkpm and mirror (PR import scenario)", async () => {
  let mirrorPath = "mirror-for-offline";
  let fixture = "install-import-pr";
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, "fbkpm.lock.before"), path.join(cwd, "fbkpm.lock"));

  return run({save: true}, [], fixture, async (config, reporter) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/mime-types/package.json"))).version, "2.0.0");
    assert(semver.satisfies(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/mime-db/package.json"))).version, "~1.0.1"));
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/fake-fbkpm-dependency/package.json"))).version, "1.0.1");

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 3);
    assert.equal(mirror[0].relative, "fake-fbkpm-dependency-1.0.1.tgz");
    assert.equal(mirror[1].relative.indexOf("mime-db-1.0."), 0);
    assert.equal(mirror[2].relative, "mime-types-2.0.0.tgz");

    let lockFileContent = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
    let lockFileLines = lockFileContent.split("\n").filter((line) => !!line);
    // TODO error here
    assert.equal(lockFileLines.length, 14);
    assert.equal(lockFileLines[4].indexOf("mime-db@"), 0);
    assert.equal(lockFileLines[8].indexOf("mime-types@2.0.0"), 0);

    await fs.unlink(path.join(mirror[1].absolute));
    await fs.unlink(path.join(mirror[2].absolute));
    await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
  });
});


test("install --save should update a dependency to fbkpm and mirror (PR import scenario 2)", async () => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11 via
  // a change in package.json,
  // files in mirror, fbkpm.lock, package.json and node_modules should reflect that

  let mirrorPath = "mirror-for-offline";
  let fixture = "install-import-pr-2";
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, "fbkpm.lock.before"), path.join(cwd, "fbkpm.lock"));
  await fs.copy(path.join(cwd, "package.json.before"), path.join(cwd, "package.json"));

  return run({}, [], fixture, async (config) => {
    assert(semver.satisfies(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
      "~1.0.1")
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
      "2.0.0"
    );

    await fs.unlink(path.join(config.cwd, "package.json"));
    await fs.copy(path.join(cwd, "package.json.after"), path.join(cwd, "package.json"));

    return run({save: true}, [], fixture, async (config) => {
      assert(semver.satisfies(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
        "~1.23.0"
      ));
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
        "2.1.11"
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
      let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
      assert.equal(lockFileLines[0], "mime-db@~1.23.0:");
      assert.notEqual(lockFileLines[3].indexOf("resolved mime-db-"), -1);
      assert.equal(lockFileLines[4], "mime-types@2.1.11:");
      assert.notEqual(lockFileLines[7].indexOf("resolved mime-types-2.1.11.tgz"), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 4);
      let newFilesInMirror = mirror.filter((elem) => {
        return elem.relative !== "mime-db-1.0.3.tgz" && elem.relative !== "mime-types-2.0.0.tgz";
      });

      assert.equal(newFilesInMirror.length, 2);

      await fs.unlink(newFilesInMirror[0].absolute);
      await fs.unlink(newFilesInMirror[1].absolute);

      await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
      await fs.unlink(path.join(config.cwd, "package.json"));
    });
  });
});

test("install --initMirror should add init mirror deps from package.json", async () => {
  let mirrorPath = "mirror-for-offline";
  let fixture = "install-init-mirror";

  // initMirror gets converted to save flag in cli/install.js
  return run({save: true}, [], fixture, async (config, reporter) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/mime-types/package.json"))).version, "2.0.0");
    assert(semver.satisfies(JSON.parse(await fs.readFile(path.join(config.cwd,
      "node_modules/mime-db/package.json"))).version, "~1.0.1"));

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 2);
    assert.equal(mirror[0].relative.indexOf("mime-db-1.0."), 0);
    assert.equal(mirror[1].relative, "mime-types-2.0.0.tgz");

    let lockFileContent = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
    let lockFileLines = lockFileContent.split("\n").filter((line) => !!line);
    assert.equal(lockFileLines.length, 10);
    assert.equal(lockFileLines[0].indexOf("mime-db@"), 0);
    assert.equal(lockFileLines[4].indexOf("mime-types@2.0.0"), 0);

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
  });
});

test("install --save with new dependency should be deterministic", async () => {
  // mime-types@2.0.0->mime-db@1.0.3 is saved in local mirror and is deduped
  // install mime-db@1.23.0 should move mime-db@1.0.3 deep into mime-types

  let mirrorPath = "mirror-for-offline";
  let fixture = "install-deterministic";
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, "fbkpm.lock.before"), path.join(cwd, "fbkpm.lock"));
  await fs.copy(path.join(cwd, "package.json.before"), path.join(cwd, "package.json"));

  return run({}, [], fixture, async (config) => {
    assert(semver.satisfies(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
      "~1.0.1")
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
      "2.0.0"
    );

    return run({save: true}, ["mime-db@1.23.0"], fixture, async (config) => {
      assert(semver.satisfies(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
        "~1.23.0"
      ));
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
        "2.0.0"
      );
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd,
          "node_modules/mime-types/node_modules/mime-db/package.json"))).version,
        "1.0.3"
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies, {
          "mime-types": "2.0.0",
          "mime-db": "1.23.0"
        }
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
      let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
      assert.equal(lockFileLines.length, 14);


      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, "mime-db-1.23.0.tgz");

      await fs.unlink(mirror[1].absolute);
      await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
      await fs.unlink(path.join(config.cwd, "package.json"));
    });
  });
});

test("install --save with new dependency should be deterministic 2", async () => {
  // mime-types@2.0.0->mime-db@1.0.1 is saved in local mirror and is deduped
  // install mime-db@1.0.3 should replace mime-db@1.0.1 in root

  let mirrorPath = "mirror-for-offline";
  let fixture = "install-deterministic-2";
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, "fbkpm.lock.before"), path.join(cwd, "fbkpm.lock"));
  await fs.copy(path.join(cwd, "package.json.before"), path.join(cwd, "package.json"));

  return run({}, [], fixture, async (config) => {
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
      "1.0.1"
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
      "2.0.0"
    );

    return run({save: true}, ["mime-db@1.0.3"], fixture, async (config) => {
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-db/package.json"))).version,
        "1.0.3"
      );
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/mime-types/package.json"))).version,
        "2.0.0"
      );
      assert(!await fs.exists(path.join(config.cwd, "node_modules/mime-types/node-modules/mime-db")));
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies, {
          "mime-types": "2.0.0",
          "mime-db": "1.0.3"
        }
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
      let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
      assert.equal(lockFileLines.length, 10);


      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, "mime-db-1.0.3.tgz");

      await fs.unlink(mirror[1].absolute);
      await fs.unlink(path.join(config.cwd, "fbkpm.lock"));
      await fs.unlink(path.join(config.cwd, "package.json"));
    });
  });
});


test("install --save should ignore cache", () => {
  // left-pad@1.1.0 gets installed without --save
  // left-pad@1.1.0 gets installed with --save
  // files in mirror, fbkpm.lock, package.json and node_modules should reflect that

  let mirrorPath = "mirror-for-offline";

  let fixture = "install-save-to-mirror-when-cached";
  return run({}, ["left-pad@1.1.0"], fixture, async (config) => {
    assert.equal(
      JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/left-pad/package.json"))).version,
      "1.1.0"
    );

    return run({save: true}, ["left-pad@1.1.0"], fixture, async (config) => {
      assert.equal(
        JSON.parse(await fs.readFile(path.join(config.cwd, "node_modules/left-pad/package.json"))).version,
        "1.1.0"
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, "package.json"))).dependencies,
        {"left-pad": "1.1.0"}
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, "fbkpm.lock"));
      let lockFileLines = lockFileWritten.split("\n").filter((line) => !!line);
      assert.equal(lockFileLines[0], "left-pad@1.1.0:");
      assert.equal(lockFileLines.length, 4);
      assert.notEqual(lockFileLines[3].indexOf("resolved left-pad-1.1.0.tgz"), -1);

      throw new Error("AA")

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 1);
      assert.equal(mirror[0].relative, "left-pad-1.1.0.tgz");
      await fs.unlink(path.join(config.cwd, mirrorPath));
      await fs.unlink(path.join(config.cwd, "package.json"));

    });
  });
});
