/* @flow */

import {run as check} from '../../src/cli/commands/check.js';
import * as constants from '../../src/constants.js';
import * as reporters from '../../src/reporters/index.js';
import {Install} from '../../src/cli/commands/install.js';
import Lockfile from '../../src/lockfile/wrapper.js';
import Config from '../../src/config.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';
import semver from 'semver';
import {getPackageVersion, explodeLockfile, runInstall, createLockfile} from './_install.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

test.concurrent('integrity hash respects flat and production flags', async () => {
  const cwd = path.join(fixturesLoc, 'noop');
  const reporter = new reporters.NoopReporter();
  const config = new Config(reporter);
  await config.init({cwd});

  const lockfile = new Lockfile();

  const install = new Install({}, config, reporter, lockfile);

  const install2 = new Install({flat: true}, config, reporter, lockfile);
  expect(install2.generateIntegrityHash('foo', [])).not.toEqual(install.generateIntegrityHash('foo', []));

  const install3 = new Install({production: true}, config, reporter, lockfile);
  expect(install3.generateIntegrityHash('foo', [])).not.toEqual(install.generateIntegrityHash('foo', []));
  expect(install3.generateIntegrityHash('foo', [])).not.toEqual(install2.generateIntegrityHash('foo', []));
});

test.concurrent('flat arg is inherited from root manifest', async (): Promise<void> => {
  const cwd = path.join(fixturesLoc, 'top-level-flat-parameter');
  const reporter = new reporters.NoopReporter();
  const config = new Config(reporter);
  await config.init({cwd});
  const install = new Install({}, config, reporter, new Lockfile());
  return install.fetchRequestFromCwd().then(function([,, manifest]) {
    assert.equal(manifest.flat, true);
    assert.equal(install.flags.flat, true);
  });
});


test.concurrent("doesn't write new lockfile if existing one satisfied", (): Promise<void> => {
  return runInstall({}, 'install-dont-write-lockfile-if-satisfied', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    assert(lockfile.indexOf('foobar') >= 0);
  });
});

test.concurrent("writes new lockfile if existing one isn't satisfied", async (): Promise<void> => {
  await runInstall({}, 'install-write-lockfile-if-not-satisfied', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    assert(lockfile.indexOf('foobar') === -1);
  });
});

test.concurrent('install transitive optional dependency from lockfile', (): Promise<void> => {
  return runInstall({}, 'install-optional-dep-from-lockfile', (config, reporter, install) => {
    assert(install && install.resolver && install.resolver.patterns['fsevents@^1.0.0']);
  });
});

test.concurrent('root install from shrinkwrap', (): Promise<void> => {
  return runInstall({}, 'root-install-with-lockfile');
});

test.concurrent('root install with optional deps', (): Promise<void> => {
  return runInstall({}, 'root-install-with-optional-dependency');
});

test.concurrent('install file: protocol', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file', async (config) => {
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
      'foobar\n',
    );
  });
});

test.concurrent('install everything when flat is enabled', (): Promise<void> => {
  return runInstall({noLockfile: true, flat: true}, 'install-file', async (config) => {
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
      'foobar\n',
    );
  });
});

test.concurrent('install renamed packages', (): Promise<void> => {
  return runInstall({}, 'install-renamed-packages', async (config): Promise<void> => {
    const dir = path.join(config.cwd, 'node_modules');

    const json = await fs.readJson(path.join(dir, 'left-pad', 'package.json'));
    assert.equal(json.version, '1.0.0');

    const json2 = await fs.readJson(path.join(dir, 'left-pad2', 'package.json'));
    assert.equal(json2.version, '1.1.0');
  });
});

test.concurrent('install from offline mirror', (): Promise<void> => {
  return runInstall({}, 'install-from-offline-mirror', async (config): Promise<void> => {

    const allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === path.join('node_modules', 'fake-dependency', 'package.json');
    }) !== -1);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === path.join('node_modules', '@fakescope', 'fake-dependency', 'package.json');
    }) !== -1);
  });
});

test.concurrent('install from git cache', (): Promise<void> => {
  return runInstall({}, 'install-from-git-cache', async (config): Promise<void> => {
    assert.equal(await getPackageVersion(config, 'dep-a'), '0.0.1');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 0', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // B@1.0.0
  // should result in B@2.0.0 not flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-0', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '2.0.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 1', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // should result in B@2.0.0 flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-1', async (config) => {
    assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
    assert.equal(await getPackageVersion(config, 'dep-a'), '2.0.1');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 2', (): Promise<void> => {
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

test.concurrent('install should dedupe dependencies avoiding conflicts 3', (): Promise<void> => {
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

test.concurrent('install should dedupe dependencies avoiding conflicts 4', (): Promise<void> => {
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

test.concurrent('install should dedupe dependencies avoiding conflicts 5', (): Promise<void> => {
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

test.concurrent(
  'install should dedupe dependencies avoiding conflicts 6 (jest/jest-runtime case)',
  (): Promise<void> => {
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
  },
);

test.concurrent('install should dedupe dependencies avoiding conflicts 7', (): Promise<void> => {
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

test.concurrent('install should dedupe dependencies avoiding conflicts 8', (): Promise<void> => {
  // revealed in https://github.com/yarnpkg/yarn/issues/112
  // adapted for https://github.com/yarnpkg/yarn/issues/1158
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-8', async (config) => {
    assert.equal(await getPackageVersion(config, 'glob'), '5.0.15');
    assert.equal(await getPackageVersion(config, 'findup-sync/glob'), '4.3.5');
    assert.equal(await getPackageVersion(config, 'inquirer'), '0.8.5');
    assert.equal(await getPackageVersion(config, 'lodash'), '3.10.1');
    assert.equal(await getPackageVersion(config, 'ast-query/lodash'), '4.15.0');
    assert.equal(await getPackageVersion(config, 'run-async'), '0.1.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 9', (): Promise<void> => {
  // revealed in https://github.com/yarnpkg/yarn/issues/112
  // adapted for https://github.com/yarnpkg/yarn/issues/1158
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-9', async (config) => {
    assert.equal(await getPackageVersion(config, 'glob'), '5.0.15');
    assert.equal(await getPackageVersion(config, 'findup-sync/glob'), '4.3.5');
    assert.equal(await getPackageVersion(config, 'inquirer'), '0.8.5');
    assert.equal(await getPackageVersion(config, 'lodash'), '3.10.1');
    assert.equal(await getPackageVersion(config, 'ast-query/lodash'), '4.15.0');
    assert.equal(await getPackageVersion(config, 'run-async'), '0.1.0');
  });
});

test.concurrent(
  'install have a clean node_modules after lockfile update (branch switch scenario)',
  (): Promise<void> => {
    // A@1 -> B@1
    // B@2

    // after package.json/lock file update

    // A@1.2 -> B@1.2

    // (deduped)

    // A@1.2
    // B@1.2

    return runInstall(
      {},
      'install-should-cleanup-when-package-json-changed',
      async (config, reporter): Promise<void> => {
        assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
        assert.equal(await getPackageVersion(config, 'dep-b'), '2.0.0');
        assert.equal(await getPackageVersion(config, 'dep-a/dep-b'), '1.0.0');

        await fs.unlink(path.join(config.cwd, 'yarn.lock'));
        await fs.unlink(path.join(config.cwd, 'package.json'));

        await fs.copy(path.join(config.cwd, 'yarn.lock.after'), path.join(config.cwd, 'yarn.lock'));
        await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'));

        const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
        await reinstall.init();

        assert.equal(await getPackageVersion(config, 'dep-a'), '1.2.0');
        assert.equal(await getPackageVersion(config, 'dep-b'), '1.2.0');
      },
    );
  },
);

test.concurrent(
  'install have a clean node_modules after lockfile update (branch switch scenario 2)',
  (): Promise<void> => {
    // A@1 -> B@1

    // after package.json/lock file update

    // A@1.2

    return runInstall(
      {},
      'install-should-cleanup-when-package-json-changed-2',
      async (config, reporter): Promise<void> => {
        assert.equal(await getPackageVersion(config, 'dep-a'), '1.0.0');
        assert.equal(await getPackageVersion(config, 'dep-b'), '1.0.0');

        await fs.unlink(path.join(config.cwd, 'yarn.lock'));
        await fs.unlink(path.join(config.cwd, 'package.json'));

        await fs.copy(path.join(config.cwd, 'yarn.lock.after'), path.join(config.cwd, 'yarn.lock'));
        await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'));

        const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
        await reinstall.init();

        assert.equal(await getPackageVersion(config, 'dep-a'), '1.2.0');
        assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-b')));
      },
    );
  },
);

test.concurrent('check should verify that top level dependencies are installed correctly', (): Promise<void> => {
  return runInstall({}, 'check-top-correct', async (config, reporter) => {

    const pkgDep = JSON.parse(await fs.readFile(path.join(
      config.cwd,
      'node_modules/fake-yarn-dependency/package.json',
    )));
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

test.concurrent('install should run install scripts in the order of dependencies', (): Promise<void> => {
  return runInstall({}, 'scripts-order', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a/dep-a-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-b/dep-b-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-c/dep-c-built'))).toBe(true);
  });
});

test.concurrent(
  'run install scripts in the order when one dependency does not have install script',
  (): Promise<void> => {
    return runInstall({}, 'scripts-order-with-one-package-missing-install-script', async (config, reporter) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a/dep-a-built'))).toBe(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-b/dep-b-built'))).toBe(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-d/dep-d-built'))).toBe(true);
    });
  },
);

test.concurrent('install should circumvent circular dependencies', (): Promise<void> => {
  return runInstall({}, 'install-should-circumvent-circular-dependencies', async (config, reporter) => {
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
  });
});

// fix https://github.com/yarnpkg/yarn/issues/466
test.concurrent('install should resolve circular dependencies 2', (): Promise<void> => {
  return runInstall({}, 'install-should-circumvent-circular-dependencies-2', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'es5-ext'),
      '0.10.12',
    );
  });
});


// don't run this test in `concurrent`, it will affect other tests
test('install should respect NODE_ENV=production', (): Promise<void> => {
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  return runInstall({}, 'install-should-respect-node_env', async (config) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/is-negative-zero/package.json'))).toBe(false);
    // restore env
    process.env.NODE_ENV = env;
  });
});


test.concurrent('install should resolve circular dependencies 2', (): Promise<void> => {
  return runInstall({}, 'install-should-circumvent-circular-dependencies-2', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'es5-ext'),
      '0.10.12',
    );
  });
});

test.concurrent('install should be idempotent', (): Promise<void> => {
  // Install a package twice
  runInstall({}, 'install-should-be-idempotent', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'dep-a'),
      '1.0.0',
    );
  }, null, false);

  return runInstall({}, 'install-should-be-idempotent', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'dep-a'),
      '1.0.0',
    );
  });
});

test.concurrent(
  'install should add missing deps to yarn and mirror (PR import scenario)',
  (): Promise<void> => {
    return runInstall({}, 'install-import-pr', async (config) => {
      assert.equal(await getPackageVersion(config, 'mime-types'), '2.0.0');
      assert(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1'));
      assert.equal(await getPackageVersion(config, 'fake-yarn-dependency'), '1.0.1');

      const mirror = await fs.walk(path.join(config.cwd, 'mirror-for-offline'));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[0].relative, 'fake-yarn-dependency-1.0.1.tgz');
      assert.equal(mirror[1].relative.indexOf('mime-db-1.0.'), 0);
      assert.equal(mirror[2].relative, 'mime-types-2.0.0.tgz');

      const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileContent);
      assert.equal(lockFileLines.length, 11);
      assert.equal(lockFileLines[3].indexOf('mime-db@'), 0);
      assert.equal(lockFileLines[6].indexOf('mime-types@2.0.0'), 0);
    });
  },
);

// disabled to resolve https://github.com/yarnpkg/yarn/pull/1210
test.skip('install should hoist nested bin scripts', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-nested-bin', async (config) => {
    const binScripts = await fs.walk(path.join(config.cwd, 'node_modules', '.bin'));
    // need to double the amount as windows makes 2 entries for each dependency
    // so for below, there would be an entry for eslint and eslint.cmd on win32
    const amount = process.platform === 'win32' ? 20 : 10;
    assert.equal(binScripts.length, amount);
    assert(binScripts.findIndex((f) => f.basename === 'eslint') > -1);
  });
});

test.concurrent('install should respect --no-bin-links flag', (): Promise<void> => {
  return runInstall({binLinks: false}, 'install-nested-bin', async (config) => {
    const binExists = await fs.exists(path.join(config.cwd, 'node_modules', '.bin'));
    assert(!binExists);
  });
});


test.concurrent('install should update a dependency to yarn and mirror (PR import scenario 2)', (): Promise<void> => {
  // mime-types@2.0.0 is gets updated to mime-types@2.1.11 via
  // a change in package.json,
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  return runInstall({}, 'install-import-pr-2', async (config, reporter): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1'),
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'));

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.23.0',
    ));
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.1.11',
    );

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);
    assert.equal(lockFileLines[0], 'mime-db@~1.23.0:');
    assert.notEqual(lockFileLines[2].indexOf('resolved mime-db-'), -1);
    assert.equal(lockFileLines[3], 'mime-types@2.1.11:');
    assert.notEqual(lockFileLines[5].indexOf('resolved mime-types-2.1.11.tgz'), -1);

    const mirror = await fs.walk(path.join(config.cwd, 'mirror-for-offline'));
    assert.equal(mirror.length, 4);
    const newFilesInMirror = mirror.filter((elem): boolean => {
      return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
    });

    assert.equal(newFilesInMirror.length, 2);
  });
});

if (process.platform !== 'win32') {
  // TODO: This seems like a real issue, not just a config issue
  test.concurrent('install cache symlinks properly', (): Promise<void> => {
    return runInstall({}, 'cache-symlinks', async (config, reporter) => {
      const symlink = path.resolve(config.cwd, 'node_modules', 'dep-a', 'link-index.js');
      expect(await fs.exists(symlink)).toBe(true);
      await fs.unlink(path.resolve(config.cwd, 'node_modules'));

      const lockfile = await createLockfile(config.cwd);
      const install = new Install({}, config, reporter, lockfile);
      await install.init();

      expect(await fs.exists(symlink)).toBe(true);
    });
  });
}

test.concurrent('install should write and read integrity file based on lockfile entries', (): Promise<void> => {
  return runInstall({}, 'lockfile-stability', async (config, reporter) => {
    let lockContent = await fs.readFile(
      path.join(config.cwd, 'yarn.lock'),
    );
    lockContent += `
# changed the file, integrity should be fine
    `;
    await fs.writeFile(
      path.join(config.cwd, 'yarn.lock'),
      lockContent,
    );
    let allCorrect = true;
    try {
      await check(config, reporter, {integrity: true}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);
    // install should bail out with integrity check
    await fs.unlink(path.join(config.cwd, 'node_modules', 'mime-types', 'package.json'));
    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    // integrity check should keep passing
    allCorrect = true;
    try {
      await check(config, reporter, {integrity: true}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);

    // full check should fail because of deleted file
    allCorrect = false;
    try {
      await check(config, reporter, {integrity: false}, []);
    } catch (err) {
      allCorrect = true;
    }
    expect(allCorrect).toBe(true);

  });
});

test.concurrent('install should not rewrite lockfile with no substantial changes', (): Promise<void> => {
  const fixture = 'lockfile-no-rewrites';

  return runInstall({}, fixture, async (config, reporter) => {
    const originalLockContent = await fs.readFile(
      path.join(config.cwd, 'yarn.lock'),
    );
    const lockContent = originalLockContent + `
# changed the file, and it should remain changed after force install
    `;
    await fs.writeFile(
      path.join(config.cwd, 'yarn.lock'),
      lockContent,
    );

    await fs.unlink(path.join(config.cwd, 'node_modules', constants.INTEGRITY_FILENAME));

    let reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    let newLockContent = await fs.readFile(
      path.join(config.cwd, 'yarn.lock'),
    );
    expect(newLockContent).toEqual(lockContent);

    // force should rewrite lockfile
    reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    newLockContent = await fs.readFile(
      path.join(config.cwd, 'yarn.lock'),
    );
    expect(newLockContent).not.toEqual(lockContent);
  });
});

test.concurrent('lockfile should be created when missing even if integrity matches', (): Promise<void> => {
  return runInstall({}, 'lockfile-missing', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'yarn.lock')));
  });
});
