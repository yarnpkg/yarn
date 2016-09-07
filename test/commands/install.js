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

import {run as uninstall} from '../../src/cli/commands/uninstall.js';
import {run as check} from '../../src/cli/commands/check.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';
import semver from 'semver';
import {runInstall, getPackageVersion, explodeLockfile} from './_install.js';

let path = require('path');
let test = require('ava');

let fixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

test('[network] root install from shrinkwrap', (): Promise<void> => {
  return runInstall({}, 'root-install-with-lockfile');
});

test('[network] root install with optional deps', (): Promise<void> => {
  return runInstall({}, 'root-install-with-optional-dependency');
});

test('install file: protocol', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file', async (config) => {
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
      'foobar\n',
    );
  });
});

test('install renamed packages', (): Promise<void> => {
  return runInstall({}, 'install-renamed-packages', async (config): Promise<void> => {
    let dir = path.join(config.cwd, 'node_modules');

    let json = await fs.readJson(path.join(dir, 'left-pad', 'package.json'));
    assert.equal(json.version, '1.0.0');

    let json2 = await fs.readJson(path.join(dir, 'left-pad2', 'package.json'));
    assert.equal(json2.version, '1.1.0');
  });
});

test('install from offline mirror', (): Promise<void> => {
  return runInstall({}, 'install-from-offline-mirror', async (config): Promise<void> => {

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
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-0', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '2.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 1', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // should result in B@2.0.0 flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-1', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.1');
  });
});

test('install should dedupe dependencies avoiding conflicts 2', (): Promise<void> => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  // B@1 -> C@1
  // should become
  // A@2
  // A@2 -> B@2
  // A@2 -> C@2
  // D@1
  // C@1
  // B@1

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-2', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-c'), '2.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 3', (): Promise<void> => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  //     -> C@1
  // should become
  // A@2
  // B@2 -> C@2
  // C@1
  // D@1
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-3', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b/dep-c'), '2.0.0');
  });
});

test('install should dedupe dependencies avoiding conflicts 4', (): Promise<void> => {
  // A@2 -> B@2 -> D@1 -> C@2
  //
  //     -> C@1

  // should become
  // A@2
  // D@1 -> C@2
  // C@1
  // B@2
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-4', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-c'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-d/dep-c'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
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

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-5', async (config) => {
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

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-6', async (config): Promise<void> => {
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

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-7', async (config) => {
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
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-8', async (config) => {
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
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-9', async (config) => {
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

  return runInstall({}, fixture, async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '1.0.0');

    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(cwd, 'kpm.lock.after'), path.join(cwd, 'kpm.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return runInstall({}, fixture, async (config) => {
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

  return runInstall({}, fixture, async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');

    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(cwd, 'kpm.lock.after'), path.join(cwd, 'kpm.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return runInstall({}, fixture, async (config) => {
      assert.equal(await getPackageVersion(config, 'dep-a'), '1.2.0');

      assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-b')));

      await fs.unlink(path.join(config.cwd, 'kpm.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test('uninstall should remove dependency from package.json, kpm.lock and node_modules', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';

  return runInstall({}, 'uninstall-should-clean', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'dep-a'),
      '1.0.0',
    );

    await fs.copy(path.join(config.cwd, 'kpm.lock'), path.join(config.cwd, 'kpm.lock.orig'));
    await fs.copy(path.join(config.cwd, 'package.json'), path.join(config.cwd, 'package.json.orig'));

    try {
      await uninstall(config, reporter, {}, ['dep-a']);

      assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));
      assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`)));

      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
        {},
      );

      let lockFileContent = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = explodeLockfile(lockFileContent);
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

  return runInstall({}, 'uninstall-should-remove-subdependencies', async (config, reporter) => {
    try {
      assert.equal(
        await getPackageVersion(config, 'dep-a'),
        '1.0.0',
      );
      assert.equal(
        await getPackageVersion(config, 'dep-b'),
        '1.0.0',
      );
      assert.equal(
        await getPackageVersion(config, 'dep-c'),
        '1.0.0',
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
        {'dep-c': '^1.0.0'},
      );

      let lockFileContent = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
      let lockFileLines = explodeLockfile(lockFileContent);
      assert.equal(lockFileLines.length, 3);
      assert.equal(lockFileLines[0], 'dep-c@^1.0.0:');
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

test('check should verify that top level dependencies are installed correctly', async (t): Promise<void> => {
  let fixture = 'check-top-correct';

  return runInstall({}, fixture, async (config, reporter) => {

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
    t.is(allCorrect, true);
  });
});

test('install should run install scripts in the order of dependencies', async (t): Promise<void> => {
  let fixture = 'scripts-order';

  return runInstall({}, fixture, async (config, reporter) => {
    t.is(await fs.exists(path.join(config.cwd, 'node_modules/dep-a/dep-a-built')), true);
    t.is(await fs.exists(path.join(config.cwd, 'node_modules/dep-b/dep-b-built')), true);
    t.is(await fs.exists(path.join(config.cwd, 'node_modules/dep-c/dep-c-built')), true);
  });
});


test('[network] install should add missing deps to kpm and mirror (PR import scenario)',
async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-import-pr';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'kpm.lock.before'), path.join(cwd, 'kpm.lock'));

  return runInstall({}, fixture, async (config) => {
    assert.equal(await getPackageVersion(config, 'mime-types'), '2.0.0');
    assert(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1'));
    assert.equal(await getPackageVersion(config, 'fake-kpm-dependency'), '1.0.1');

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 3);
    assert.equal(mirror[0].relative, 'fake-kpm-dependency-1.0.1.tgz');
    assert.equal(mirror[1].relative.indexOf('mime-db-1.0.'), 0);
    assert.equal(mirror[2].relative, 'mime-types-2.0.0.tgz');

    let lockFileContent = await fs.readFile(path.join(config.cwd, 'kpm.lock'));
    let lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 11);
    assert.equal(lockFileLines[3].indexOf('mime-db@'), 0);
    assert.equal(lockFileLines[6].indexOf('mime-types@2.0.0'), 0);

    await fs.unlink(path.join(mirror[1].absolute));
    await fs.unlink(path.join(mirror[2].absolute));
    await fs.unlink(path.join(config.cwd, 'kpm.lock'));
  });
});
