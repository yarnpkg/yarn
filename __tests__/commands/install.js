/* @flow */

import {run as uninstall} from '../../src/cli/commands/uninstall.js';
import {run as check} from '../../src/cli/commands/check.js';
import * as reporters from '../../src/reporters/index.js';
import {Install} from '../../src/cli/commands/install.js';
import Lockfile from '../../src/lockfile/wrapper.js';
import Config from '../../src/config.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';
import semver from 'semver';
import parallelTest from '../_parallel-test.js';
import {getPackageVersion, explodeLockfile, runInstall, createLockfile} from './_install.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

let path = require('path');

let fixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

parallelTest('integrity hash respects flat and production flags', () => {
  let cwd = path.join(fixturesLoc, 'noop');
  let reporter = new reporters.NoopReporter();
  let config = new Config(reporter, {cwd});
  let lockfile = new Lockfile();

  let install = new Install({}, config, reporter, lockfile);

  let install2 = new Install({flat: true}, config, reporter, lockfile);
  assert(install2.generateIntegrityHash('foo') !== install.generateIntegrityHash('foo'));

  let install3 = new Install({production: true}, config, reporter, lockfile);
  assert(install3.generateIntegrityHash('foo') !== install.generateIntegrityHash('foo'));
  assert(install3.generateIntegrityHash('foo') !== install2.generateIntegrityHash('foo'));
});

parallelTest('flat arg is inherited from root manifest', (): Promise<void> => {
  let cwd = path.join(fixturesLoc, 'top-level-flat-parameter');
  let reporter = new reporters.NoopReporter();
  let config = new Config(reporter, {cwd});
  let install = new Install({}, config, reporter, new Lockfile());
  return install.fetchRequestFromCwd().then(function([,, manifest]) {
    assert.equal(manifest.flat, true);
    assert.equal(install.flags.flat, true);
  });
});


parallelTest("doesn't write new lockfile if existing one satisfied", (): Promise<void> => {
  return runInstall({}, 'install-dont-write-lockfile-if-satisfied', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    assert(lockfile.indexOf('foobar') >= 0);
  });
});

parallelTest("writes new lockfile if existing one isn't satisfied", async (): Promise<void> => {
  let fixture = 'install-write-lockfile-if-not-satisfied';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));

  try {
    await runInstall({}, fixture, async (config): Promise<void> => {
      const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      assert(lockfile.indexOf('foobar') === -1);
    });
  } finally {
    await fs.unlink(path.join(cwd, 'yarn.lock'));
  }
});

parallelTest('install transitive optional dependency from lockfile', (): Promise<void> => {
  return runInstall({}, 'install-optional-dep-from-lockfile', (config, reporter, install) => {
    assert(install && install.resolver && install.resolver.patterns['fsevents@^1.0.0']);
  });
});

parallelTest('root install from shrinkwrap', (): Promise<void> => {
  return runInstall({}, 'root-install-with-lockfile');
});

parallelTest('root install with optional deps', (): Promise<void> => {
  return runInstall({}, 'root-install-with-optional-dependency');
});

parallelTest('install file: protocol', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file', async (config) => {
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
      'foobar\n',
    );
  });
});

parallelTest('install renamed packages', (): Promise<void> => {
  return runInstall({}, 'install-renamed-packages', async (config): Promise<void> => {
    let dir = path.join(config.cwd, 'node_modules');

    let json = await fs.readJson(path.join(dir, 'left-pad', 'package.json'));
    assert.equal(json.version, '1.0.0');

    let json2 = await fs.readJson(path.join(dir, 'left-pad2', 'package.json'));
    assert.equal(json2.version, '1.1.0');
  });
});

parallelTest('install from offline mirror', (): Promise<void> => {
  return runInstall({}, 'install-from-offline-mirror', async (config): Promise<void> => {

    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === path.join('node_modules', 'fake-dependency', 'package.json');
    }) !== -1);
  });
});

parallelTest('install should dedupe dependencies avoiding conflicts 0', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // B@1.0.0
  // should result in B@2.0.0 not flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-0', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '2.0.0');
  });
});

parallelTest('install should dedupe dependencies avoiding conflicts 1', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // should result in B@2.0.0 flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-1', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.1');
  });
});

parallelTest('install should dedupe dependencies avoiding conflicts 2', (): Promise<void> => {
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

parallelTest('install should dedupe dependencies avoiding conflicts 3', (): Promise<void> => {
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

parallelTest('install should dedupe dependencies avoiding conflicts 4', (): Promise<void> => {
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

parallelTest('install should dedupe dependencies avoiding conflicts 5', (): Promise<void> => {
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

parallelTest('install should dedupe dependencies avoiding conflicts 6 (jest/jest-runtime case)', (): Promise<void> => {
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

parallelTest('install should dedupe dependencies avoiding conflicts 7', (): Promise<void> => {
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

parallelTest('install should dedupe dependencies avoiding conflicts 8', (): Promise<void> => {
  // revealed in https://github.com/yarnpkg/yarn/issues/112
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-8', async (config) => {
    assert.equal(await getPackageVersion(config, 'glob'), '5.0.15');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/globby/glob'), '6.0.4');
    assert.equal(await getPackageVersion(config, 'inquirer'), '0.8.5');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/inquirer'), '1.1.3');
    assert.equal(await getPackageVersion(config, 'lodash'), '3.10.1');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/lodash'), '4.15.0');
    assert.equal(await getPackageVersion(config, 'run-async'), '0.1.0');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/run-async'), '2.2.0');
  });
});


parallelTest('install should dedupe dependencies avoiding conflicts 9', (): Promise<void> => {
  // revealed in https://github.com/yarnpkg/yarn/issues/112
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-9', async (config) => {
    assert.equal(await getPackageVersion(config, 'glob'), '5.0.15');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/globby/glob'), '6.0.4');
    assert.equal(await getPackageVersion(config, 'inquirer'), '0.8.5');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/inquirer'), '1.1.3');
    assert.equal(await getPackageVersion(config, 'lodash'), '3.10.1');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/lodash'), '4.15.0');
    assert.equal(await getPackageVersion(config, 'run-async'), '0.1.0');
    assert.equal(await getPackageVersion(config, 'yeoman-generator/yeoman-environment/run-async'), '2.2.0');
  });
});

parallelTest('install have a clean node_modules after lockfile update (branch switch scenario)',
async (): Promise<void> => {
  // A@1 -> B@1
  // B@2

  // after package.json/lock file update

  // A@1.2 -> B@1.2

  // (deduped)

  // A@1.2
  // B@1.2

  let fixture = 'install-should-cleanup-when-package-json-changed';
  let cwd = path.join(fixturesLoc, fixture);

  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runInstall({}, fixture, async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '1.0.0');

    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(cwd, 'yarn.lock.after'), path.join(cwd, 'yarn.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return runInstall({}, fixture, async (config) => {
      assert.equal(await getPackageVersion(config, 'dep-a'), '1.2.0');
      assert.equal(await getPackageVersion(config, 'dep-b'), '1.2.0');

      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});


parallelTest('install have a clean node_modules after lockfile update (branch switch scenario 2)',
async (): Promise<void> => {
  // A@1 -> B@1

  // after package.json/lock file update

  // A@1.2

  let fixture = 'install-should-cleanup-when-package-json-changed-2';
  let cwd = path.join(fixturesLoc, fixture);

  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runInstall({}, fixture, async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');

    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(cwd, 'yarn.lock.after'), path.join(cwd, 'yarn.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return runInstall({}, fixture, async (config) => {
      assert.equal(await getPackageVersion(config, 'dep-a'), '1.2.0');

      assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-b')));

      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

parallelTest('uninstall should remove dependency from package.json, yarn.lock and node_modules', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';

  return runInstall({}, 'uninstall-should-clean', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'dep-a'),
      '1.0.0',
    );

    await fs.copy(path.join(config.cwd, 'yarn.lock'), path.join(config.cwd, 'yarn.lock.orig'));
    await fs.copy(path.join(config.cwd, 'package.json'), path.join(config.cwd, 'package.json.orig'));

    try {
      await uninstall(config, reporter, {}, ['dep-a']);

      assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));
      assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`)));

      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
        {},
      );

      let lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileContent);
      assert.equal(lockFileLines.length, 0);
    } finally {
      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
      await fs.copy(path.join(config.cwd, 'yarn.lock.orig'), path.join(config.cwd, 'yarn.lock'));
      await fs.copy(path.join(config.cwd, 'package.json.orig'), path.join(config.cwd, 'package.json'));
      await fs.unlink(path.join(config.cwd, 'yarn.lock.orig'));
      await fs.unlink(path.join(config.cwd, 'package.json.orig'));
    }
  });
});

parallelTest('uninstall should remove subdependencies', (): Promise<void> => {
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

      await fs.copy(path.join(config.cwd, 'yarn.lock'), path.join(config.cwd, 'yarn.lock.orig'));
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

      let lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileContent);
      assert.equal(lockFileLines.length, 3);
      assert.equal(lockFileLines[0], 'dep-c@^1.0.0:');
    } finally {
      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
      await fs.copy(path.join(config.cwd, 'yarn.lock.orig'), path.join(config.cwd, 'yarn.lock'));
      await fs.copy(path.join(config.cwd, 'package.json.orig'), path.join(config.cwd, 'package.json'));
      await fs.unlink(path.join(config.cwd, 'yarn.lock.orig'));
      await fs.unlink(path.join(config.cwd, 'package.json.orig'));
    }
  });
});

parallelTest('check should verify that top level dependencies are installed correctly', (): Promise<void> => {
  let fixture = 'check-top-correct';

  return runInstall({}, fixture, async (config, reporter) => {

    let pkgDep = JSON.parse(await fs.readFile(path.join(config.cwd,
      'node_modules/fake-yarn-dependency/package.json')));
    pkgDep.version = '2.0.0';
    await fs.writeFile(
      path.join(config.cwd, 'node_modules/fake-yarn-dependency/package.json'),
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

parallelTest('install should run install scripts in the order of dependencies', (): Promise<void> => {
  let fixture = 'scripts-order';

  return runInstall({}, fixture, async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a/dep-a-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-b/dep-b-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-c/dep-c-built'))).toBe(true);
  });
});

parallelTest('install should add missing deps to yarn and mirror (PR import scenario)',
async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-import-pr';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));

  return runInstall({}, fixture, async (config) => {
    assert.equal(await getPackageVersion(config, 'mime-types'), '2.0.0');
    assert(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1'));
    assert.equal(await getPackageVersion(config, 'fake-yarn-dependency'), '1.0.1');

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 3);
    assert.equal(mirror[0].relative, 'fake-yarn-dependency-1.0.1.tgz');
    assert.equal(mirror[1].relative.indexOf('mime-db-1.0.'), 0);
    assert.equal(mirror[2].relative, 'mime-types-2.0.0.tgz');

    let lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    let lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 11);
    assert.equal(lockFileLines[3].indexOf('mime-db@'), 0);
    assert.equal(lockFileLines[6].indexOf('mime-types@2.0.0'), 0);

    await fs.unlink(path.join(mirror[1].absolute));
    await fs.unlink(path.join(mirror[2].absolute));
    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
  });
});

if (process.platform !== 'win32') {
  // TODO: This seems like a real issue, not just a config issue
  parallelTest('install cache symlinks properly', (): Promise<void> => {
    let fixture = 'cache-symlinks';

    return runInstall({}, fixture, async (config, reporter) => {
      const symlink = path.resolve(config.cwd, 'node_modules', 'dep-a', 'link-index.js');
      expect(await fs.exists(symlink)).toBe(true);
      await fs.unlink(path.resolve(config.cwd, 'node_modules'));

      let lockfile = await createLockfile(config.cwd);
      let install = new Install({}, config, reporter, lockfile);
      await install.init();

      expect(await fs.exists(symlink)).toBe(true);
    });
  });
}
