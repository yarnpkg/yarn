/* @flow */

import {run as check} from '../../../src/cli/commands/check.js';
import * as constants from '../../../src/constants.js';
import * as reporters from '../../../src/reporters/index.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile/wrapper.js';
import * as fs from '../../../src/util/fs.js';
import {getPackageVersion, explodeLockfile, runInstall, createLockfile} from '../_helpers.js';
import {promisify} from '../../../src/util/promise';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const request = require('request');
const assert = require('assert');
const semver = require('semver');
const fsNode = require('fs');
const path = require('path');
const os = require('os');

beforeEach(request.__resetAuthedRequests);
// $FlowFixMe
afterEach(request.__resetAuthedRequests);

test.concurrent('properly find and save build artifacts', async () => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const cacheFolder = path.join(config.cacheFolder, 'npm-dummy-0.0.0');
    assert.deepEqual(
      (await fs.readJson(path.join(cacheFolder, constants.METADATA_FILENAME))).artifacts,
      ['dummy', path.join('dummy', 'dummy.txt'), 'dummy.txt'],
    );

    // retains artifact
    const moduleFolder = path.join(config.cwd, 'node_modules', 'dummy');
    assert.equal(await fs.readFile(path.join(moduleFolder, 'dummy.txt')), 'foobar');
    assert.equal(await fs.readFile(path.join(moduleFolder, 'dummy', 'dummy.txt')), 'foobar');
  });
});

test.concurrent("removes extraneous files that aren't in module or artifacts", async () => {
  async function check(cwd: string): Promise<void> {
    // retains artifact
    const moduleFolder = path.join(cwd, 'node_modules', 'dummy');
    assert.equal(await fs.readFile(path.join(moduleFolder, 'dummy.txt')), 'foobar');
    assert.equal(await fs.readFile(path.join(moduleFolder, 'dummy', 'dummy.txt')), 'foobar');

    // removes extraneous
    assert.ok(!(await fs.exists(path.join(moduleFolder, 'dummy2.txt'))));
  }

  async function create(cwd: string): Promise<void> {
    // create an extraneous file
    const moduleFolder = path.join(cwd, 'node_modules', 'dummy');
    await fs.mkdirp(moduleFolder);
    await fs.writeFile(path.join(moduleFolder, 'dummy2.txt'), 'foobar');
  }

  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    await check(config.cwd);

    await create(config.cwd);

    // run install again
    const install = new Install({force: true}, config, config.reporter, new Lockfile());
    await install.init();

    await check(config.cwd);
  }, create);
});

test.concurrent("production mode with deduped dev dep shouldn't be removed", async () => {
  await runInstall({production: true}, 'install-prod-deduped-dev-dep', async (config) => {
    assert.equal(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version,
      '1.0.0',
    );

    assert.equal(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version,
      '1.0.0',
    );

    assert.ok(
      !await fs.exists(path.join(config.cwd, 'node_modules', 'b')),
    );
  });
});

test.concurrent('hoisting should factor ignored dependencies', async () => {
  // you should only modify this test if you know what you're doing
  // when we calculate hoisting we need to factor in ignored dependencies in it
  // so we get deterministic hoisting across environments, for example in production mode
  // we should still be taking dev dependencies into consideration

  async function checkNormal(config): Promise<void> {
    assert.equal(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version,
      '1.0.0',
    );

    assert.equal(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'd', 'package.json'))).version,
      '1.0.0',
    );

    assert.equal(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'd', 'node_modules', 'c', 'package.json'))).version,
      '2.0.0',
    );
  }

  await runInstall({}, 'install-ignored-retains-hoisting-structure', async (config) => {
    await checkNormal(config);

    assert.equal(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'b', 'package.json'))).version,
      '3.0.0',
    );

    assert.equal(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version,
      '5.0.0',
    );
  });

  await runInstall({production: true}, 'install-ignored-retains-hoisting-structure', async (config) => {
    await checkNormal(config);

    assert.ok(
      !await fs.exists(path.join(config.cwd, 'node_modules', 'b')),
    );

    assert.ok(
      !await fs.exists(path.join(config.cwd, 'node_modules', 'c')),
    );
  });
});

test.concurrent('--production flag ignores dev dependencies', () => {
  return runInstall({production: true}, 'install-production', async (config) => {
    assert.ok(
      !await fs.exists(path.join(config.cwd, 'node_modules', 'lodash')),
    );

    assert.ok(
      await fs.exists(path.join(config.cwd, 'node_modules', 'react')),
    );
  });
});

test.concurrent('--production flag does not link dev dependency bin scripts', () => {
  return runInstall({production: true, binLinks: true}, 'install-production-bin', async (config) => {
    assert.ok(
      !await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'touch')),
    );

    assert.ok(
      await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'rimraf')),
    );
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

test.concurrent('writes a lockfile even when there are no dependencies', (): Promise<void> => {
  // https://github.com/yarnpkg/yarn/issues/679
  return runInstall({}, 'install-without-dependencies', async (config) => {
    const lockfileExists = await fs.exists(path.join(config.cwd, 'yarn.lock'));
    const installedDepFiles = await fs.walk(path.join(config.cwd, 'node_modules'));

    assert(lockfileExists);
    // 1 for integrity file (located in node_modules)
    assert.equal(installedDepFiles.length, 1);
  });
});

test.concurrent(
  "throws an error if existing lockfile isn't satisfied with --frozen-lockfile",
  async (): Promise<void> => {
    const reporter = new reporters.ConsoleReporter({});

    let thrown = false;
    try {
      await runInstall({frozenLockfile: true}, 'install-throws-error-if-not-satisfied-and-frozen-lockfile', () => {});
    } catch (err) {
      thrown = true;
      expect(err.message).toContain(reporter.lang('frozenLockfileError'));
    }
    assert(thrown);
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

test.concurrent('install file: protocol with relative paths', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file-relative', async (config) => {
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'root-a', 'index.js')),
      'foobar\n',
    );
  });
});

test.concurrent('install file: protocol without cache', async (): Promise<void> => {
  const fixturesLoc = path.join(__dirname, '..', '..', 'fixtures', 'install');
  const compLoc = path.join(fixturesLoc, 'install-file-without-cache', 'comp', 'index.js');

  await fs.writeFile(compLoc, 'foo\n');
  await runInstall({}, 'install-file-without-cache', async (config, reporter) => {
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js')),
      'foo\n',
    );

    await fs.writeFile(compLoc, 'bar\n');

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    // TODO: This should actually be equal. See https://github.com/yarnpkg/yarn/pull/2443.
    assert.notEqual(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js')),
      'bar\n',
    );
  });
});

test.concurrent('install file: local packages with local dependencies', async (): Promise<void> => {
  await runInstall({}, 'install-file-local-dependency', async (config, reporter) => {
    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'a', 'index.js')),
      'foo\n',
    );
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'b', 'index.js')),
      'bar\n',
    );
  });
});

test.concurrent('install file: protocol', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file', async (config) => {
    assert.equal(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
      'foobar\n',
    );
  });
});

test.concurrent('install with file: protocol as default', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file-as-default', async (config) => {
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

test.concurrent('install from github', (): Promise<void> => {
  return runInstall({}, 'install-github');
});

test.concurrent('check and install should verify integrity in the same way when flat', (): Promise<void> => {
  return runInstall({flat: true}, 'install-should-dedupe-avoiding-conflicts-1', async (config, reporter) => {
    // Will raise if check doesn't flatten the patterns
    await check(config, reporter, {flat: true, integrity: true}, []);
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

        await fs.copy(path.join(config.cwd, 'yarn.lock.after'), path.join(config.cwd, 'yarn.lock'), reporter);
        await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

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

        await fs.copy(path.join(config.cwd, 'yarn.lock.after'), path.join(config.cwd, 'yarn.lock'), reporter);
        await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

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

// don't run this test in `concurrent`, it will affect other tests
test('install should respect NPM_CONFIG_PRODUCTION=false over NODE_ENV=production', (): Promise<void> => {
  const env = process.env.NODE_ENV;
  const prod = process.env.NPM_CONFIG_PRODUCTION;
  process.env.NODE_ENV = 'production';
  process.env.NPM_CONFIG_PRODUCTION = 'false';
  return runInstall({}, 'install-should-respect-npm_config_production', async (config) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/is-negative-zero/package.json'))).toBe(true);
    // restore env
    process.env.NODE_ENV = env;
    process.env.NPM_CONFIG_PRODUCTION = prod;
  });
});

// don't run this test in `concurrent`, it will affect other tests
test('install should respect production flag false over NODE_ENV=production', (): Promise<void> => {
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  return runInstall({production: 'false'}, 'install-should-respect-production_flag_over_node-env', async (config) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/is-negative-zero/package.json'))).toBe(true);
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

    await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

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
      await fs.unlink(path.join(config.cwd, 'node_modules'));

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

test.concurrent('install infers line endings from existing win32 lockfile', async (): Promise<void> => {
  await runInstall({}, 'install-infers-line-endings-from-existing-lockfile',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'yarn.lock'), 'utf8');
      assert(/\r\n/.test(lockfile));
      assert(!/[^\r]\n/.test(lockfile));
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\r\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'yarn.lock'), existingLockfile, 'utf8');
    });
});

test.concurrent('install infers line endings from existing unix lockfile', async (): Promise<void> => {
  await runInstall({}, 'install-infers-line-endings-from-existing-lockfile',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'yarn.lock'), 'utf8');
      assert(/[^\r]\n/.test(lockfile));
      assert(!/\r\n/.test(lockfile));
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'yarn.lock'), existingLockfile, 'utf8');
    });
});

test.concurrent('install uses OS line endings when lockfile doesn\'t exist', async (): Promise<void> => {
  await runInstall({}, 'install-infers-line-endings-from-existing-lockfile',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'yarn.lock'), 'utf8');
      assert(lockfile.indexOf(os.EOL) >= 0);
    });
});

// sync test because we need to get all the requests to confirm their validity
test('install a scoped module from authed private registry', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-from-authed-private-registry', async (config) => {
    const authedRequests = request.__getAuthedRequests();
    assert.equal(authedRequests[0].url, 'https://registry.yarnpkg.com/@types%2flodash');
    assert.equal(authedRequests[0].headers.authorization, 'Bearer abc123');
    assert.equal(authedRequests[1].url, 'https://registry.yarnpkg.com/@types/lodash/-/lodash-4.14.37.tgz');
    assert.equal(authedRequests[1].headers.authorization, 'Bearer abc123');
    assert.equal(
      (await fs.readFile(path.join(config.cwd, 'node_modules', '@types', 'lodash', 'index.d.ts'))).split('\n')[0],
      '// Type definitions for Lo-Dash 4.14',
    );
  });
});

test('install a scoped module from authed private registry with a missing trailing slash', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-from-authed-private-registry-no-slash', async (config) => {
    const authedRequests = request.__getAuthedRequests();
    assert.equal(authedRequests[0].url, 'https://registry.yarnpkg.com/@types%2flodash');
    assert.equal(authedRequests[0].headers.authorization, 'Bearer abc123');
    assert.equal(authedRequests[1].url, 'https://registry.yarnpkg.com/@types/lodash/-/lodash-4.14.37.tgz');
    assert.equal(authedRequests[1].headers.authorization, 'Bearer abc123');
    assert.equal(
      (await fs.readFile(path.join(config.cwd, 'node_modules', '@types', 'lodash', 'index.d.ts'))).split('\n')[0],
      '// Type definitions for Lo-Dash 4.14',
    );
  });
});

test.concurrent('install will not overwrite files in symlinked scoped directories', async (): Promise<void> => {
  await runInstall({}, 'install-dont-overwrite-linked-scoped', async (config): Promise<void> => {
    const dependencyPath = path.join(config.cwd, 'node_modules', '@fakescope', 'fake-dependency');
    assert.equal(
      'Symlinked scoped package test',
      (await fs.readJson(path.join(dependencyPath, 'package.json'))).description,
    );
    assert.ok(!(await fs.exists(path.join(dependencyPath, 'index.js'))));
  }, async (cwd) => {
    const dirToLink = path.join(cwd, 'dir-to-link');
    await fs.mkdirp(path.join(cwd, '.yarn-link', '@fakescope'));
    await fs.symlink(dirToLink, path.join(cwd, '.yarn-link', '@fakescope', 'fake-dependency'));
    await fs.mkdirp(path.join(cwd, 'node_modules', '@fakescope'));
    await fs.symlink(dirToLink, path.join(cwd, 'node_modules', '@fakescope', 'fake-dependency'));
  });
});

test.concurrent('install of scoped package with subdependency conflict should pass check', (): Promise<void> => {
  return runInstall({}, 'install-scoped-package-with-subdependency-conflict', async (config, reporter) => {
    let allCorrect = true;
    try {
      await check(config, reporter, {integrity: false}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);
  });
});

test.concurrent('install a module with incompatible optional dependency should skip dependency',
  (): Promise<void> => {
    return runInstall({}, 'install-should-skip-incompatible-optional-dep', async (config) => {
      assert.ok(!(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-incompatible'))));
    });
  });

test.concurrent('install a module with incompatible optional dependency should skip transient dependencies',
  (): Promise<void> => {
    return runInstall({}, 'install-should-skip-incompatible-optional-dep', async (config) => {
      assert.ok(!(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a'))));
    });
  });

// this tests for a problem occuring due to optional dependency incompatible with os, in this case fsevents
// this would fail on os's incompatible with fsevents, which is everything except osx.
if (process.platform !== 'darwin') {
  test.concurrent('install incompatible optional dependency should still install shared child dependencies',
    (): Promise<void> => {
      return runInstall({}, 'install-should-not-skip-required-shared-deps', async (config) => {
        assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'deep-extend')));
        assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'ini')));
        assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'strip-json-comments')));
      });
    });
}

test.concurrent('optional dependency that fails to build should not be installed',
  (): Promise<void> => {
    return runInstall({}, 'should-not-install-failing-optional-deps', async (config) => {
      assert.equal(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-failing')), false);
    });
  });

// Covers current behavior, issue opened whether this should be changed https://github.com/yarnpkg/yarn/issues/2274
test.concurrent('a subdependency of an optional dependency that fails should be installed',
  (): Promise<void> => {
    return runInstall({}, 'should-install-failing-optional-sub-deps', async (config) => {
      assert.equal(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-failing')), false);
      assert.equal(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep')), true);
    });
  });

test.concurrent('should not loose dependencies when installing with --production',
  (): Promise<void> => {
    // revealed https://github.com/yarnpkg/yarn/issues/2263
    return runInstall({production: true}, 'prod-should-keep-subdeps', async (config) => {
      // would be hoisted from gulp/vinyl-fs/glob-stream/minimatch/brace-expansion/balanced-match
      assert.equal(await getPackageVersion(config, 'balanced-match'), '0.4.2');
    });
  });

// https://github.com/yarnpkg/yarn/issues/2470
test.concurrent('a allows dependency with [] in os cpu requirements',
  (): Promise<void> => {
    return runInstall({}, 'empty-os', async (config) => {
      assert(await fs.exists(path.join(config.cwd, 'node_modules', 'feed')));
    });
  });
