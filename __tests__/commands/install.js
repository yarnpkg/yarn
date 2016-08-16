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

import { Reporter } from '../../src/reporters/index.js';
import * as reporters from '../../src/reporters/index.js';
import * as constants from '../../src/constants.js';
import { default as Lockfile, parse } from '../../src/lockfile/index.js';
import { Install } from '../../src/cli/commands/install.js';
import { run as uninstall } from '../../src/cli/commands/uninstall.js';
import { run as check } from '../../src/cli/commands/check.js';
import Config from '../../src/config.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';
import semver from 'semver';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

let stream = require('stream');
let path = require('path');

let fixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

async function clean(cwd, removeLock) {
  await fs.unlink(path.join(cwd, constants.MODULE_CACHE_DIRECTORY));
  await fs.unlink(path.join(cwd, 'node_modules'));
  if (removeLock) {
    await fs.unlink(path.join(cwd, constants.LOCKFILE_FILENAME));
  }
}

async function createLockfile(dir, strict, save): Promise<Lockfile> {
  let lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
  let lockfile;

  if (await fs.exists(lockfileLoc)) {
    let rawLockfile = await fs.readFile(lockfileLoc);
    lockfile = parse(rawLockfile);
  }

  return new Lockfile(lockfile, strict, save);
}

async function run(
  flags: Object,
  args: Array<string>,
  name: string,
  checkInstalled: ?(config: Config, reporter: Reporter) => ?Promise<void>,
  beforeInstall: ?(cwd: string) => ?Promise<void>
): Promise<void> {
  let out = '';
  let stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  let reporter = new reporters.ConsoleReporter({ stdout, stderr: stdout });

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
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    let config = new Config(reporter, { cwd });
    await config.init();

    let install = new Install('install', flags, args, config, reporter, lockfile);
    await install.init();
    // self check to verify consistency after installation
    await check(config, reporter, flags, args);
    try {
      if (checkInstalled) {
        await checkInstalled(config, reporter);
      }
    } finally {
      // clean up
      await clean(cwd, removeLock);
    }
  } catch (err) {
    throw new Error(`${err} \nConsole output:\n ${out}`);
  }
}

async function getPackageVersion(config, packagePath): Promise<string> {
  let loc = path.join(config.cwd, `node_modules/${packagePath.replace(/\//g, '/node_modules/')}/package.json`);
  let json = JSON.parse(await fs.readFile(loc));
  return json.version;
}

test('[network] root install from shrinkwrap', (): Promise<void> => {
  return run({}, [], 'root-install-with-lockfile');
});

test('[network] root install with optional deps', (): Promise<void> => {
  return run({}, [], 'root-install-with-optional-dependency');
});

test('[network] install with arg that has install scripts', (): Promise<void> => {
  return run({}, ['flow-bin'], 'install-with-arg-and-install-scripts');
});

test('[network] install with arg', (): Promise<void> => {
  return run({}, ['is-online'], 'install-with-arg');
});

test('[network] install with arg that has binaries', (): Promise<void> => {
  return run({}, ['react-native-cli'], 'install-with-arg-and-bin');
});

test('[network] install with --save and offline mirror', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  return run({save: true}, ['is-array@^1.0.1'], 'install-with-save-offline-mirror', async (config) => {
    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) !== -1);

    let rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert.equal(lockfile['is-array@^1.0.1']['resolved'],
      'is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a');

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

test('[network] install with --save and without offline mirror', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  return run({save: true}, ['is-array@^1.0.1'], 'install-with-save-no-offline-mirror', async (config) => {

    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) === -1);

    let rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert.equal(lockfile['is-array@^1.0.1']['resolved'],
      'https://registry.npmjs.org/is-array/-/is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a');

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

it('install renamed packages', (): Promise<void> => {
  return run({}, [], 'install-renamed-packages', async (config): Promise<void> => {
    let dir = path.join(config.cwd, 'node_modules');

    let json = await fs.readJson(path.join(dir, 'left-pad', 'package.json'));
    assert.equal(json.version, '1.0.0');

    let json2 = await fs.readJson(path.join(dir, 'left-pad2', 'package.json'));
    assert.equal(json2.version, '1.1.0');
  });
});

test('install from offline mirror', (): Promise<void> => {
  return run({}, [], 'install-from-offline-mirror', async (config): Promise<void> => {

    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === 'node_modules/fake-dependency/package.json';
    }) !== -1);
  });
});

test('install should dedupe dependencies avoiding conflicts 0', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // B@1.0.0
  // should result in B@2.0.0 not flattened
  return run({}, [], 'install-should-dedupe-avoiding-conflicts-0', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '2.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 1', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // should result in B@2.0.0 flattened
  return run({}, [], 'install-should-dedupe-avoiding-conflicts-1', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.1');
  });
});

test('install should dedupe dependencies avoiding conflicts 2', (): Promise<void> => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  // B@1 -> C@1
  // should become
  // A@2 -> B@2
  // D@1
  // B@1 -> C@1
  // C@2

  return run({}, [], 'install-should-dedupe-avoiding-conflicts-2', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b/dep-c'), '1.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 3', (): Promise<void> => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  //     -> C@1
  // should become
  // A@2 -> C@1
  // B@2
  // C@2
  // D@1
  return run({}, [], 'install-should-dedupe-avoiding-conflicts-3', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-c'), '1.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 4', (): Promise<void> => {
  // A@2 -> B@2 -> D@1 -> C@2
  //
  //     -> C@1

  // should become

  // A@2 -> C@1
  // C@2
  // B@2
  // D@1
  return run({}, [], 'install-should-dedupe-avoiding-conflicts-4', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-c'), '1.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 5', (): Promise<void> => {
  // A@1 -> B@1
  // C@1 -> D@1 -> A@2 -> B@2

  // should become

  // A@1
  // B@1
  // C@1
  // D@1 -> A@2
  //     -> B@2

  return run({}, [], 'install-should-dedupe-avoiding-conflicts-5', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d/dep-a'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d/dep-b'), '2.0.0');

  });
});

test('install should dedupe dependencies avoiding conflicts 6 (jest/jest-runtime case)', (): Promise<void> => {
  // C@1 -> D@1 -> E@1
  // B@1 -> C@1 -> D@1 -> E@1
  // D@2
  // E@2

  // should become

  // C@1 -> D@1
  //     -> E@1
  // B@1
  // D@2
  // E@2

  return run({}, [], 'install-should-dedupe-avoiding-conflicts-6', async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-e'), '2.0.0');

    assert.equal(await getPackageVersion(config, 'dep-c/dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c/dep-e'), '1.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 7', (): Promise<void> => {
  // A@1 -> C@1 -> D@1 -> E@1
  // B@1 -> C@1 -> D@1 -> E@1
  // C@2
  // D@2
  // E@2

  // should become

  // A@1 -> C@1
  //     -> D@1
  //     -> E@1
  // B@1 -> C@1
  //     -> D@1
  //     -> E@1
  // C@2
  // D@2
  // E@2

  return run({}, [], 'install-should-dedupe-avoiding-conflicts-7', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-e'), '2.0.0');

    assert.equal(await getPackageVersion(config, 'dep-a/dep-c'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-e'), '1.0.0');


    assert.equal(await getPackageVersion(config, 'dep-b/dep-c'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b/dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b/dep-e'), '1.0.0');

  });
});

test('install should dedupe dependencies avoiding conflicts 8', (): Promise<void> => {
  // revealed in https://github.com/facebook/fbkpm/issues/112
  return run({}, [], 'install-should-dedupe-avoiding-conflicts-8', async (config) => {
    assert.equal(await getPackageVersion(config, 'glob'), '5.0.15');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/globby/glob'), '6.0.4');
    assert.equal(await getPackageVersion(config, 'inquirer'), '0.8.5');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/inquirer'), '1.1.2');
    assert.equal(await getPackageVersion(config, 'lodash'), '3.10.1');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/lodash'), '4.13.1');
    assert.equal(await getPackageVersion(config, 'run-async'), '0.1.0');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/run-async'), '2.2.0');
  });
});


test('install should dedupe dependencies avoiding conflicts 9', (): Promise<void> => {
  // revealed in https://github.com/facebook/fbkpm/issues/112
  return run({}, [], 'install-should-dedupe-avoiding-conflicts-9', async (config) => {
    assert.equal(await getPackageVersion(config, 'glob'), '5.0.15');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/globby/glob'), '6.0.4');
    assert.equal(await getPackageVersion(config, 'inquirer'), '0.8.5');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/inquirer'), '1.1.2');
    assert.equal(await getPackageVersion(config, 'lodash'), '3.10.1');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/lodash'), '4.13.1');
    assert.equal(await getPackageVersion(config, 'run-async'), '0.1.0');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/run-async'), '2.2.0');
  });
});

test('upgrade scenario', (): Promise<void> => {
  // left-pad first installed 0.0.9 then updated to 1.1.0
  // files in mirror, kpm.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';

  async function clean(cwd) {
    await fs.unlink(path.join(cwd, mirrorPath));
    await fs.unlink(path.join(cwd, 'kpm.lock'));
    await fs.unlink(path.join(cwd, 'package.json'));
  }

  return run({ save: true }, ['left-pad@0.0.9'], 'install-upgrade-scenario', async (config): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '0.0.9'
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '0.0.9'}
    );

    let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
    let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
    assert.equal(lockFileLines[0], 'left-pad@0.0.9:');
    assert.equal(lockFileLines.length, 3);
    assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-0.0.9.tgz'), -1);

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-0.0.9.tgz');

    return run({save: true}, ['left-pad@1.1.0'], 'install-upgrade-scenario', async (config) => {
      assert.equal(
        await getPackageVersion(config, 'left-pad'),
        '1.1.0'
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
        {'left-pad': '1.1.0'}
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
      assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
      assert.equal(lockFileLines.length, 3);
      assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-1.1.0.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 2);
      assert.equal(mirror[1].relative, 'left-pad-1.1.0.tgz');

      await clean(config.cwd);
    });
  }, clean);
});

test('[network] upgrade scenario 2 (with sub dependencies)', async (): Promise<void> => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11
  // files in mirror, kpm.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-upgrade-scenario-2';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({}, [], fixture, async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1')
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0'
    );

    return run({save: true}, ['mime-types@^2.1.11'], fixture, async (config) => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '~1.23.0'
      ));
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.1.11'
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
      assert.equal(lockFileLines[0], 'mime-db@~1.23.0:');
      assert.notEqual(lockFileLines[2].indexOf('resolved mime-db-'), -1);
      assert.equal(lockFileLines[3], 'mime-types@^2.1.11:');
      assert.notEqual(lockFileLines[5].indexOf('resolved mime-types-2.1.11.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 4);
      let newFilesInMirror = mirror.filter((elem): boolean => {
        return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
      });

      assert.equal(newFilesInMirror.length, 2);

      await fs.unlink(newFilesInMirror[0].absolute);
      await fs.unlink(newFilesInMirror[1].absolute);

      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test('[network] downgrade scenario', (): Promise<void> => {
  // left-pad first installed 1.1.0 then downgraded to 0.0.9
  // files in mirror, kpm.lock, package.json and node_modules should reflect that

  return run({save: true}, ['left-pad@1.1.0'], 'install-downgrade-scenario', async (config): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0'
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '1.1.0'}
    );

    let mirrorPath = 'mirror-for-offline';
    let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
    let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
    assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
    assert.equal(lockFileLines.length, 3);
    assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-1.1.0.tgz'), -1);

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-1.1.0.tgz');

    return run({save: true}, ['left-pad@0.0.9'], 'install-downgrade-scenario', async (config) => {
      assert.equal(
        await getPackageVersion(config, 'left-pad'),
        '0.0.9'
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
        {'left-pad': '0.0.9'}
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
      assert.equal(lockFileLines[0], 'left-pad@0.0.9:');
      assert.equal(lockFileLines.length, 3);
      assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-0.0.9.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 2);
      assert.equal(mirror[0].relative, 'left-pad-0.0.9.tgz');

      await fs.unlink(path.join(config.cwd, mirrorPath));
      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test('install have a clean node_modules after lockfile update (branch switch scenario)', async (): Promise<void> => {
  // A@1 -> B@1
  // B@2

  // after package.json/lock file update

  // A@1.2 -> B@1.2

  // (deduped)

  // A@1.2
  // B@1.2

  let fixture = 'install-should-cleanup-when-package-json-changed';
  let cwd = path.join(fixturesLoc, fixture);

  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({}, [], fixture, async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '1.0.0');

    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(cwd, 'kpm.lock.after'), path.join(cwd, 'kpm.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return run({}, [], fixture, async (config) => {
      assert.equal(await getPackageVersion(config, 'dep-a'), '1.2.0');
      assert.equal(await getPackageVersion(config, 'dep-b'), '1.2.0');

      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});


test('install have a clean node_modules after lockfile update (branch switch scenario 2)', async (): Promise<void> => {
  // A@1 -> B@1

  // after package.json/lock file update

  // A@1.2

  let fixture = 'install-should-cleanup-when-package-json-changed-2';
  let cwd = path.join(fixturesLoc, fixture);

  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({}, [], fixture, async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');

    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(cwd, 'kpm.lock.after'), path.join(cwd, 'kpm.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return run({}, [], fixture, async (config) => {
      assert.equal(await getPackageVersion(config, 'dep-a'), '1.2.0');

      assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-b')));

      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test('uninstall should remove dependency from package.json, kpm.lock and node_modules', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';

  return run({}, [], 'uninstall-should-clean', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'dep-a'),
      '1.0.0'
    );

    await fs.copy(path.join(config.cwd, 'kpm.lock'), path.join(config.cwd, 'kpm.lock.orig'));
    await fs.copy(path.join(config.cwd, 'package.json'), path.join(config.cwd, 'package.json.orig'));

    try {
      await uninstall(config, reporter, {}, ['dep-a']);

      assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));
      assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`)));

      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
        {}
      );

      let lockFileContent = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = lockFileContent.split('\n').filter((line): boolean => !!line);
      assert.equal(lockFileLines.length, 0);
    } finally {
      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
      await fs.copy(path.join(config.cwd, 'kpm.lock.orig'), path.join(config.cwd, 'kpm.lock'));
      await fs.copy(path.join(config.cwd, 'package.json.orig'), path.join(config.cwd, 'package.json'));
      await fs.unlink(path.join(config.cwd, 'kpm.lock.orig'));
      await fs.unlink(path.join(config.cwd, 'package.json.orig'));
    }
  });
});

test('uninstall should remove subdependencies', (): Promise<void> => {
  // A@1 -> B@1
  // C@1

  // remove A

  // C@1

  let mirrorPath = 'mirror-for-offline';

  return run({}, [], 'uninstall-should-remove-subdependencies', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'dep-a'),
      '1.0.0'
    );
    assert.equal(
      await getPackageVersion(config, 'dep-b'),
      '1.0.0'
    );
    assert.equal(
      await getPackageVersion(config, 'dep-c'),
      '1.0.0'
    );

    await fs.copy(path.join(config.cwd, 'kpm.lock'), path.join(config.cwd, 'kpm.lock.orig'));
    await fs.copy(path.join(config.cwd, 'package.json'), path.join(config.cwd, 'package.json.orig'));

    await uninstall(config, reporter, {}, ['dep-a']);

    assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));
    assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-b')));
    assert(await fs.exists(path.join(config.cwd, 'node_modules/dep-c')));

    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`)));
    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-b-1.0.0.tgz`)));
    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-c-1.0.0.tgz`)));

    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'dep-c': '^1.0.0'}
    );

    let lockFileContent = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
    let lockFileLines = lockFileContent.split('\n').filter((line): boolean => !!line);
    assert.equal(lockFileLines.length, 3);
    assert.equal(lockFileLines[0], 'dep-c@^1.0.0:');

    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));
    await fs.copy(path.join(config.cwd, 'kpm.lock.orig'), path.join(config.cwd, 'kpm.lock'));
    await fs.copy(path.join(config.cwd, 'package.json.orig'), path.join(config.cwd, 'package.json'));
    await fs.unlink(path.join(config.cwd, 'kpm.lock.orig'));
    await fs.unlink(path.join(config.cwd, 'package.json.orig'));
  });
});

test('[network] install --save should add missing deps to kpm and mirror (PR import scenario)',
async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-import-pr';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));

  return run({save: true}, [], fixture, async (config) => {
    assert.equal(await getPackageVersion(config, 'mime-types'), '2.0.0');
    assert(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1'));
    assert.equal(await getPackageVersion(config, 'fake-kpm-dependency'), '1.0.1');

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 3);
    assert.equal(mirror[0].relative, 'fake-kpm-dependency-1.0.1.tgz');
    assert.equal(mirror[1].relative.indexOf('mime-db-1.0.'), 0);
    assert.equal(mirror[2].relative, 'mime-types-2.0.0.tgz');

    let lockFileContent = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
    let lockFileLines = lockFileContent.split('\n').filter((line): boolean => !!line);
    assert.equal(lockFileLines.length, 11);
    assert.equal(lockFileLines[3].indexOf('mime-db@'), 0);
    assert.equal(lockFileLines[6].indexOf('mime-types@2.0.0'), 0);

    await fs.unlink(path.join(mirror[1].absolute));
    await fs.unlink(path.join(mirror[2].absolute));
    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
  });
});

test('[network] install --save should update a dependency to kpm and mirror (PR import scenario 2)',
async (): Promise<void> => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11 via
  // a change in package.json,
  // files in mirror, kpm.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-import-pr-2';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({}, [], fixture, async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1')
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0'
    );

    await fs.unlink(path.join(config.cwd, 'package.json'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return run({save: true}, [], fixture, async (config) => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '~1.23.0'
      ));
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.1.11'
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
      assert.equal(lockFileLines[0], 'mime-db@~1.23.0:');
      assert.notEqual(lockFileLines[2].indexOf('resolved mime-db-'), -1);
      assert.equal(lockFileLines[3], 'mime-types@2.1.11:');
      assert.notEqual(lockFileLines[5].indexOf('resolved mime-types-2.1.11.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 4);
      let newFilesInMirror = mirror.filter((elem): boolean => {
        return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
      });

      assert.equal(newFilesInMirror.length, 2);

      await fs.unlink(newFilesInMirror[0].absolute);
      await fs.unlink(newFilesInMirror[1].absolute);

      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test('[network] install --initMirror should add init mirror deps from package.json', async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-init-mirror';

  // initMirror gets converted to save flag in cli/install.js
  return run({save: true}, [], fixture, async (config) => {
    assert.equal(await getPackageVersion(config, 'mime-types'), '2.0.0');
    assert(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1'));

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 2);
    assert.equal(mirror[0].relative.indexOf('mime-db-1.0.'), 0);
    assert.equal(mirror[1].relative, 'mime-types-2.0.0.tgz');

    let lockFileContent = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
    let lockFileLines = lockFileContent.split('\n').filter((line): boolean => !!line);
    assert.equal(lockFileLines.length, 8);
    assert.equal(lockFileLines[0].indexOf('mime-db@'), 0);
    assert.equal(lockFileLines[3].indexOf('mime-types@2.0.0'), 0);

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'kpm.lock'));

  });
});

test('[network] install --save with new dependency should be deterministic', async (): Promise<void> => {
  // mime-types@2.0.0->mime-db@1.0.3 is saved in local mirror and is deduped
  // install mime-db@1.23.0 should move mime-db@1.0.3 deep into mime-types

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-deterministic';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({}, [], fixture, async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1')
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0'
    );

    return run({save: true}, ['mime-db@^1.23.0'], fixture, async (config) => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '~1.23.0'
      ));
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.0.0'
      );
      assert.equal(
        await getPackageVersion(config, 'mime-types/mime-db'),
        '1.0.3'
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies, {
          'mime-types': '2.0.0',
          'mime-db': '^1.23.0',
        }
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
      assert.equal(lockFileLines.length, 11);


      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, 'mime-db-1.23.0.tgz');

      await fs.unlink(mirror[1].absolute);
      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

// TODO https://github.com/facebook/kpm/issues/79
xit('[network] install --save with new dependency should be deterministic 2', async (): Promise<void> => {
  // mime-types@2.0.0->mime-db@1.0.1 is saved in local mirror and is deduped
  // install mime-db@1.0.3 should replace mime-db@1.0.1 in root

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-deterministic-2';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({}, [], fixture, async (config): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'mime-db'),
      '1.0.1'
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0'
    );

    return run({save: true}, ['mime-db@1.0.3'], fixture, async (config) => {
      assert.equal(
        await getPackageVersion(config, 'mime-db'),
        '1.0.3'
      );
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.0.0'
      );
      assert(!await fs.exists(path.join(config.cwd, 'node_modules/mime-types/node-modules/mime-db')));
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies, {
          'mime-types': '2.0.0',
          'mime-db': '1.0.3',
        }
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
      assert.equal(lockFileLines.length, 8);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, 'mime-db-1.0.3.tgz');

      await fs.unlink(mirror[1].absolute);
      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test('[network] install --save with new dependency should be deterministic 3', async (): Promise<void> => {

  let fixture = 'install-should-cleanup-when-package-json-changed-3';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({}, [], fixture, async (config, reporter) => {

    // expecting kpm check after installation not to fail

    await fs.copy(path.join(cwd, 'kpm.lock.after'), path.join(cwd, 'kpm.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    let lockfile = await createLockfile(config.cwd, false, true);
    let install = new Install('install', {save: true}, [], config, reporter, lockfile);
    await install.init();
    let allCorrect = true;
    try {
      await check(config, reporter, {}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);

    // cleanup
    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

test('[network] install --save should ignore cache', (): Promise<void> => {
  // left-pad@1.1.0 gets installed without --save
  // left-pad@1.1.0 gets installed with --save
  // files in mirror, kpm.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-save-to-mirror-when-cached';

  return run({}, ['left-pad@1.1.0'], fixture, async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0'
    );

    let lockfile = await createLockfile(config.cwd, false, true);
    let install = new Install('install', {save: true}, ['left-pad@1.1.0'], config, reporter, lockfile);
    await install.init();
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0'
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '1.1.0'}
    );

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-1.1.0.tgz');

    let lockFileWritten = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
    let lockFileLines = lockFileWritten.split('\n').filter((line): boolean => !!line);
    assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
    assert.equal(lockFileLines.length, 3);
    assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-1.1.0.tgz'), -1);

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

test('[network] install --save should not make package.json strict', async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-no-strict';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({save: true}, ['left-pad@^1.1.0'], fixture, async (config) => {
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {
        'left-pad': '^1.1.0',
        'mime-types': '^2.0.0',
      }
    );

    await fs.unlink(path.join(config.cwd, `${mirrorPath}/left-pad-*.tgz`));
    await fs.unlink(path.join(config.cwd, 'package.json'));
    await fs.unlink(path.join(config.cwd, 'kpm.lock'));

  });
});

test('[network] install --save-exact should not make all package.json strict', async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-no-strict-all';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return run({saveExact: true, save: true}, ['left-pad@1.1.0'], fixture, async (config) => {
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {
        'left-pad': '1.1.0',
        'mime-types': '^2.0.0',
      }
    );

    await fs.unlink(path.join(config.cwd, `${mirrorPath}/left-pad-1.1.0.tgz`));
    await fs.unlink(path.join(config.cwd, 'package.json'));
    await fs.unlink(path.join(config.cwd, 'kpm.lock'));

  });
});

test('check should verify that top level dependencies are installed correctly', async (): Promise<void> => {
  let fixture = 'check-top-correct';

  return run({}, [], fixture, async (config, reporter) => {

    let pkgDep = JSON.parse(await fs.readFile(path.join(config.cwd,
      'node_modules/fake-kpm-dependency/package.json')));
    pkgDep.version = '2.0.0';
    await fs.writeFile(
      path.join(config.cwd, 'node_modules/fake-kpm-dependency/package.json'),
      JSON.stringify(pkgDep, null, 4),
    );

    let allCorrect = false;
    try {
      await check(config, reporter, {}, []);
    } catch (err) {
      allCorrect = true;
    }
    expect(allCorrect).toBe(true);

  });
});
