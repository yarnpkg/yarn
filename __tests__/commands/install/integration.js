/* @flow */

import type Config from '../../../src/config';
import PackageResolver from '../../../src/package-resolver.js';
import {run as cache} from '../../../src/cli/commands/cache.js';
import {run as check} from '../../../src/cli/commands/check.js';
import * as constants from '../../../src/constants.js';
import * as reporters from '../../../src/reporters/index.js';
import {parse} from '../../../src/lockfile/wrapper.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile/wrapper.js';
import * as fs from '../../../src/util/fs.js';
import {getPackageVersion, explodeLockfile, runInstall, createLockfile} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

let request = require('request');
const semver = require('semver');
const path = require('path');
const stream = require('stream');

async function mockConstants(base: Config, mocks: Object, cb: (config: Config) => Promise<void>): Promise<void> {
  // We cannot put this function inside _helpers, because we need to change the "request" variable
  // after resetting the modules. Updating this variable is required because some tests check what
  // happened during the Yarn execution, and they need to use the same instance of "request" than
  // the Yarn environment.

  const opts = {};

  opts.binLinks = base.binLinks;
  opts.cwd = base.cwd;
  opts.globalFolder = base.globalFolder;
  opts.linkFolder = base.linkFolder;
  opts.production = base.production;
  opts.cacheFolder = base._cacheRootFolder;

  const automock = jest.genMockFromModule('../../../src/constants');
  jest.setMock('../../../src/constants', Object.assign(automock, mocks));

  jest.resetModules();
  request = require('request');

  jest.mock('../../../src/constants');
  await cb(await require('../../../src/config.js').default.create(opts, base.reporter));
  jest.unmock('../../../src/constants');
}

beforeEach(request.__resetAuthedRequests);
afterEach(request.__resetAuthedRequests);

test.concurrent('properly find and save build artifacts', async () => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const cacheFolder = path.join(config.cacheFolder, 'npm-dummy-0.0.0');

    expect(
      (await fs.readJson(path.join(cacheFolder, constants.METADATA_FILENAME))).artifacts,
    ).toEqual(
      ['dummy', path.join('dummy', 'dummy.txt'), 'dummy.txt'],
    );

    // retains artifact
    const moduleFolder = path.join(config.cwd, 'node_modules', 'dummy');
    expect(await fs.readFile(path.join(moduleFolder, 'dummy.txt'))).toEqual('foobar');
    expect(await fs.readFile(path.join(moduleFolder, 'dummy', 'dummy.txt'))).toEqual('foobar');
  });
});

test('changes the cache path when bumping the cache version', async () => {
  await runInstall({}, 'install-github', async (config): Promise<void> => {
    const inOut = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: inOut});

    await cache(config, reporter, {}, ['dir']);
    expect((JSON.parse(String(inOut.read())) : any).data).toMatch(/[\\\/]v1[\\\/]?$/);

    await mockConstants(config, {CACHE_VERSION: 42}, async (config): Promise<void> => {
      await cache(config, reporter, {}, ['dir']);
      expect((JSON.parse(String(inOut.read())) : any).data).toMatch(/[\\\/]v42[\\\/]?$/);
    });
  });
});

test('changes the cache directory when bumping the cache version', async () => {
  await runInstall({}, 'install-production', async (config, reporter): Promise<void> => {
    const lockfile = await Lockfile.fromDirectory(config.cwd);

    const resolver = new PackageResolver(config, lockfile);
    await resolver.init([{pattern: 'is-array', registry: 'npm'}]);

    const ref = resolver.getPackageReferences()[0];
    const cachePath = config.generateHardModulePath(ref, true);

    await fs.writeFile(path.join(cachePath, 'yarn.test'), 'YARN TEST');
    await fs.unlink(path.join(config.cwd, 'node_modules'));

    const firstReinstall = new Install({skipIntegrityCheck: true}, config, reporter, lockfile);
    await firstReinstall.init();

    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'is-array', 'yarn.test'))).toEqual(true);

    await mockConstants(config, {CACHE_VERSION: 42}, async (config): Promise<void> => {
      const secondReinstall = new Install({skipIntegrityCheck: true}, config, reporter, lockfile);
      await secondReinstall.init();

      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'is-array', 'yarn.test'))).toEqual(false);
    });
  });
});

test.concurrent("removes extraneous files that aren't in module or artifacts", async () => {
  async function check(cwd: string): Promise<void> {
    // retains artifact
    const moduleFolder = path.join(cwd, 'node_modules', 'dummy');
    expect(await fs.readFile(path.join(moduleFolder, 'dummy.txt'))).toEqual('foobar');
    expect(await fs.readFile(path.join(moduleFolder, 'dummy', 'dummy.txt'))).toEqual('foobar');

    // removes extraneous
    expect(await fs.exists(path.join(moduleFolder, 'dummy2.txt'))).toEqual(false);
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
    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version,
    ).toEqual(
      '1.0.0',
    );

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version,
    ).toEqual(
      '1.0.0',
    );

    expect(
      await fs.exists(path.join(config.cwd, 'node_modules', 'b')),
    ).toEqual(false);
  });
});

test.concurrent("production mode dep on package in dev deps shouldn't be removed", async () => {
  await runInstall({production: true}, 'install-prod-deduped-direct-dev-dep', async (config) => {
    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version,
    ).toEqual('1.0.0');

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'b', 'package.json'))).version,
    ).toEqual('1.0.0');

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version,
    ).toEqual('1.0.0');
  });
});

test.concurrent('hoisting should factor ignored dependencies', async () => {
  // you should only modify this test if you know what you're doing
  // when we calculate hoisting we need to factor in ignored dependencies in it
  // so we get deterministic hoisting across environments, for example in production mode
  // we should still be taking dev dependencies into consideration

  async function checkNormal(config): Promise<void> {
    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version,
    ).toEqual(
      '1.0.0',
    );

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'd', 'package.json'))).version,
    ).toEqual(
      '1.0.0',
    );

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'd', 'node_modules', 'c', 'package.json'))).version,
    ).toEqual(
      '2.0.0',
    );
  }

  await runInstall({}, 'install-ignored-retains-hoisting-structure', async (config) => {
    await checkNormal(config);

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'b', 'package.json'))).version,
    ).toEqual(
      '3.0.0',
    );

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version,
    ).toEqual(
      '5.0.0',
    );
  });

  await runInstall({production: true}, 'install-ignored-retains-hoisting-structure', async (config) => {
    await checkNormal(config);

    expect(
      await fs.exists(path.join(config.cwd, 'node_modules', 'b')),
    ).toEqual(false);

    expect(
      await fs.exists(path.join(config.cwd, 'node_modules', 'c')),
    ).toEqual(false);
  });
});

test.concurrent('--production flag ignores dev dependencies', () => {
  return runInstall({production: true}, 'install-production', async (config) => {
    expect(
      await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad')),
    ).toEqual(false);

    expect(
      await fs.exists(path.join(config.cwd, 'node_modules', 'is-array')),
    ).toEqual(true);
  });
});

test.concurrent('--production flag does not link dev dependency bin scripts', () => {
  return runInstall({production: true, binLinks: true}, 'install-production-bin', async (config) => {
    expect(
      await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'touch')),
    ).toEqual(false);

    expect(
      await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'rimraf')),
    ).toEqual(true);
  });
});


test.concurrent('root install with optional deps', (): Promise<void> => {
  return runInstall({}, 'root-install-with-optional-dependency');
});

test.concurrent('install file: protocol with relative paths', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file-relative', async (config) => {
    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'root-a', 'index.js')),
    ).toEqual(
      'foobar\n',
    );
  });
});

test.concurrent('install file: protocol without cache', async (): Promise<void> => {
  const fixturesLoc = path.join(__dirname, '..', '..', 'fixtures', 'install');
  const compLoc = path.join(fixturesLoc, 'install-file-without-cache', 'comp', 'index.js');

  await fs.writeFile(compLoc, 'foo\n');
  await runInstall({}, 'install-file-without-cache', async (config, reporter) => {
    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js')),
    ).toEqual(
      'foo\n',
    );

    await fs.writeFile(compLoc, 'bar\n');

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    // TODO: This should actually be equal. See https://github.com/yarnpkg/yarn/pull/2443.
    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js')),
    ).not.toEqual(
      'bar\n',
    );
  });
});

test.concurrent('install file: local packages with local dependencies', async (): Promise<void> => {
  await runInstall({}, 'install-file-local-dependency', async (config, reporter) => {
    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'a', 'index.js')),
    ).toEqual(
      'foo\n',
    );

    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'b', 'index.js')),
    ).toEqual(
      'bar\n',
    );
  });
});

test.concurrent('install file: protocol', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file', async (config) => {
    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
    ).toEqual(
      'foobar\n',
    );
  });
});

test.concurrent('install with file: protocol as default', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-file-as-default', async (config) => {
    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
    ).toEqual(
      'foobar\n',
    );
  });
});

test.concurrent('install everything when flat is enabled', (): Promise<void> => {
  return runInstall({noLockfile: true, flat: true}, 'install-file', async (config) => {
    expect(
      await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js')),
    ).toEqual(
      'foobar\n',
    );
  });
});

test.concurrent('install renamed packages', (): Promise<void> => {
  return runInstall({}, 'install-renamed-packages', async (config): Promise<void> => {
    const dir = path.join(config.cwd, 'node_modules');

    const json = await fs.readJson(path.join(dir, 'left-pad', 'package.json'));
    expect(json.version).toEqual('1.0.0');

    const json2 = await fs.readJson(path.join(dir, 'left-pad2', 'package.json'));
    expect(json2.version).toEqual('1.1.0');
  });
});

test.concurrent('install from offline mirror', (): Promise<void> => {
  return runInstall({}, 'install-from-offline-mirror', async (config): Promise<void> => {

    const allFiles = await fs.walk(config.cwd);

    expect(allFiles.findIndex((file): boolean => {
      return file.relative === path.join('node_modules', 'fake-dependency', 'package.json');
    })).toBeGreaterThanOrEqual(0);

    expect(allFiles.findIndex((file): boolean => {
      return file.relative === path.join('node_modules', '@fakescope', 'fake-dependency', 'package.json');
    })).toBeGreaterThanOrEqual(0);
  });
});

test.concurrent('install from git cache', (): Promise<void> => {
  return runInstall({}, 'install-from-git-cache', async (config): Promise<void> => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('0.0.1');
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
    expect(
      await getPackageVersion(config, 'dep-a'),
    ).toEqual(
      '1.0.0',
    );

    expect(
      await getPackageVersion(config, 'dep-b'),
    ).toEqual(
      '1.0.0',
    );

    expect(
      await getPackageVersion(config, 'dep-c'),
    ).toEqual(
      '1.0.0',
    );
  });
});

test.concurrent('install should resolve circular dependencies 2', (): Promise<void> => {
  return runInstall({}, 'install-should-circumvent-circular-dependencies-2', async (config, reporter) => {
    expect(
      await getPackageVersion(config, 'es5-ext'),
    ).toEqual(
      '0.10.12',
    );
  });
});

test.concurrent('install should be idempotent', (): Promise<void> => {
  // Install a package twice
  runInstall({}, 'install-should-be-idempotent', async (config, reporter) => {
    expect(
      await getPackageVersion(config, 'dep-a'),
    ).toEqual(
      '1.0.0',
    );
  }, null, false);

  return runInstall({}, 'install-should-be-idempotent', async (config, reporter) => {
    expect(
      await getPackageVersion(config, 'dep-a'),
    ).toEqual(
      '1.0.0',
    );
  });
});

test.concurrent(
  'install should add missing deps to yarn and mirror (PR import scenario)',
  (): Promise<void> => {
    return runInstall({}, 'install-import-pr', async (config) => {
      expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');
      expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1')).toEqual(true);
      expect(await getPackageVersion(config, 'fake-yarn-dependency')).toEqual('1.0.1');

      const mirror = await fs.walk(path.join(config.cwd, 'mirror-for-offline'));
      expect(mirror).toHaveLength(3);
      expect(mirror[0].relative).toEqual('fake-yarn-dependency-1.0.1.tgz');
      expect(mirror[1].relative.indexOf('mime-db-1.0.')).toEqual(0);
      expect(mirror[2].relative).toEqual('mime-types-2.0.0.tgz');

      const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileContent);
      expect(lockFileLines).toHaveLength(11);
      expect(lockFileLines[3].indexOf('mime-db@')).toEqual(0);
      expect(lockFileLines[6].indexOf('mime-types@2.0.0')).toEqual(0);
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
    expect(binScripts).toHaveLength(amount);
    expect(binScripts.findIndex((f) => f.basename === 'eslint')).toBeGreaterThanOrEqual(0);
  });
});

test.concurrent('install should respect --no-bin-links flag', (): Promise<void> => {
  return runInstall({binLinks: false}, 'install-nested-bin', async (config) => {
    const binExists = await fs.exists(path.join(config.cwd, 'node_modules', '.bin'));
    expect(binExists).toBeFalsy();
  });
});

test.concurrent('install should update a dependency to yarn and mirror (PR import scenario 2)', (): Promise<void> => {
  // mime-types@2.0.0 is gets updated to mime-types@2.1.11 via
  // a change in package.json,
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  return runInstall({}, 'install-import-pr-2', async (config, reporter): Promise<void> => {
    expect(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1',
    )).toEqual(true);

    expect(
      await getPackageVersion(config, 'mime-types'),
    ).toEqual(
      '2.0.0',
    );

    await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.23.0',
    )).toEqual(true);

    expect(
      await getPackageVersion(config, 'mime-types'),
    ).toEqual(
      '2.1.11',
    );

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);

    expect(lockFileLines[0]).toEqual('mime-db@~1.23.0:');
    expect(lockFileLines[2]).toMatch(
      /resolved "https:\/\/registry\.yarnpkg\.com\/mime-db\/-\/mime-db-/,
    );

    expect(lockFileLines[3]).toEqual('mime-types@2.1.11:');
    expect(lockFileLines[5]).toMatch(
      /resolved "https:\/\/registry\.yarnpkg\.com\/mime-types\/-\/mime-types-2\.1\.11\.tgz#[a-f0-9]+"/,
    );

    const mirror = await fs.walk(path.join(config.cwd, 'mirror-for-offline'));
    expect(mirror).toHaveLength(4);

    const newFilesInMirror = mirror.filter((elem): boolean => {
      return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
    });

    expect(newFilesInMirror).toHaveLength(2);
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

test.concurrent('offline mirror can be enabled from parent dir', (): Promise<void> => {
  const fixture = {source: 'offline-mirror-configuration', cwd: 'enabled-from-parent'};
  return runInstall({}, fixture, async (config, reporter) => {
    const rawLockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockfile = parse(rawLockfile);
    expect(lockfile['mime-types@2.1.14'].resolved).toEqual(
      'https://registry.yarnpkg.com/mime-types/-/mime-types-2.1.14.tgz#f7ef7d97583fcaf3b7d282b6f8b5679dab1e94ee',
    );
    expect(await fs.exists(path.join(config.cwd, '../offline-mirror/mime-types-2.1.14.tgz'))).toBe(true);
  });
});

test.concurrent('offline mirror can be enabled from parent dir, with merging of own .yarnrc', (): Promise<void> => {
  const fixture = {source: 'offline-mirror-configuration', cwd: 'enabled-from-parent-merge'};
  return runInstall({}, fixture, async (config, reporter) => {
    const rawLockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockfile = parse(rawLockfile);
    expect(lockfile['mime-types@2.1.14'].resolved).toEqual(
      'https://registry.yarnpkg.com/mime-types/-/mime-types-2.1.14.tgz#f7ef7d97583fcaf3b7d282b6f8b5679dab1e94ee',
    );
    expect(await fs.exists(path.join(config.cwd, '../offline-mirror/mime-types-2.1.14.tgz'))).toBe(true);
  });
});

test.concurrent('offline mirror can be disabled locally', (): Promise<void> => {
  const fixture = {source: 'offline-mirror-configuration', cwd: 'disabled-locally'};
  return runInstall({}, fixture, async (config, reporter) => {
    const rawLockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockfile = parse(rawLockfile);
    expect(lockfile['mime-types@2.1.14'].resolved).toEqual(
      'https://registry.yarnpkg.com/mime-types/-/mime-types-2.1.14.tgz#f7ef7d97583fcaf3b7d282b6f8b5679dab1e94ee',
    );
    expect(await fs.exists(path.join(config.cwd, '../offline-mirror/mime-types-2.1.14.tgz'))).toBe(false);
  });
});

// sync test because we need to get all the requests to confirm their validity
test('install a scoped module from authed private registry', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-from-authed-private-registry', async (config) => {
    const authedRequests = request.__getAuthedRequests();

    expect(authedRequests[0].url).toEqual('https://registry.yarnpkg.com/@types%2flodash');
    expect(authedRequests[0].headers.authorization).toEqual('Bearer abc123');
    expect(authedRequests[1].url).toEqual('https://registry.yarnpkg.com/@types/lodash/-/lodash-4.14.37.tgz');
    expect(authedRequests[1].headers.authorization).toEqual('Bearer abc123');

    expect(
      (await fs.readFile(path.join(config.cwd, 'node_modules', '@types', 'lodash', 'index.d.ts'))).split('\n')[0],
    ).toEqual(
      '// Type definitions for Lo-Dash 4.14',
    );
  });
});

test('install a scoped module from authed private registry with a missing trailing slash', (): Promise<void> => {
  return runInstall({noLockfile: true}, 'install-from-authed-private-registry-no-slash', async (config) => {
    const authedRequests = request.__getAuthedRequests();

    expect(authedRequests[0].url).toEqual('https://registry.yarnpkg.com/@types%2flodash');
    expect(authedRequests[0].headers.authorization).toEqual('Bearer abc123');
    expect(authedRequests[1].url).toEqual('https://registry.yarnpkg.com/@types/lodash/-/lodash-4.14.37.tgz');
    expect(authedRequests[1].headers.authorization).toEqual('Bearer abc123');

    expect(
      (await fs.readFile(path.join(config.cwd, 'node_modules', '@types', 'lodash', 'index.d.ts'))).split('\n')[0],
    ).toEqual(
      '// Type definitions for Lo-Dash 4.14',
    );
  });
});

test.concurrent('install will not overwrite files in symlinked scoped directories', async (): Promise<void> => {
  await runInstall({}, 'install-dont-overwrite-linked-scoped', async (config): Promise<void> => {
    const dependencyPath = path.join(config.cwd, 'node_modules', '@fakescope', 'fake-dependency');
    expect(
      'Symlinked scoped package test',
    ).toEqual(
      (await fs.readJson(path.join(dependencyPath, 'package.json'))).description,
    );
    expect(await fs.exists(path.join(dependencyPath, 'index.js'))).toEqual(false);
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
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-incompatible'))).toEqual(false);
    });
  });

test.concurrent('install a module with incompatible optional dependency should skip transient dependencies',
  (): Promise<void> => {
    return runInstall({}, 'install-should-skip-incompatible-optional-dep', async (config) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a'))).toEqual(false);
    });
  });

test.concurrent('install a module with optional dependency should skip incompatible transient dependency',
  (): Promise<void> => {
    return runInstall({}, 'install-should-skip-incompatible-optional-sub-dep', async (config) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-optional'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-incompatible'))).toEqual(false);
    });
  });

// this tests for a problem occuring due to optional dependency incompatible with os, in this case fsevents
// this would fail on os's incompatible with fsevents, which is everything except osx.
if (process.platform !== 'darwin') {
  test.concurrent('install incompatible optional dependency should still install shared child dependencies',
    (): Promise<void> => {
      return runInstall({}, 'install-should-not-skip-required-shared-deps', async (config) => {
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'deep-extend'))).toEqual(true);
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'ini'))).toEqual(true);
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'strip-json-comments'))).toEqual(true);
      });
    });
}

test.concurrent('optional dependency that fails to build should not be installed',
  (): Promise<void> => {
    return runInstall({}, 'should-not-install-failing-optional-deps', async (config) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-failing'))).toEqual(false);
    });
  });

test.concurrent('failing dependency of optional dependency should not be installed',
  (): Promise<void> => {
    return runInstall({}, 'should-not-install-failing-deps-of-optional-deps', async (config) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-dep'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-failing'))).toEqual(false);
    });
  });

// Covers current behavior, issue opened whether this should be changed https://github.com/yarnpkg/yarn/issues/2274
test.concurrent('a subdependency of an optional dependency that fails should be installed',
  (): Promise<void> => {
    return runInstall({}, 'should-install-failing-optional-sub-deps', async (config) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-failing'))).toEqual(false);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(true);
    });
  });

test.concurrent('a sub-dependency should be non-optional if any parents mark it non-optional',
  async (): Promise<void> => {
    let thrown = false;
    try {
      await runInstall({}, 'failing-sub-dep-optional-and-normal', () => {});
    } catch (err) {
      thrown = true;
      expect(err.message).toContain('sub-failing: Command failed');
    }
    expect(thrown).toEqual(true);
  });


test.concurrent('should not loose dependencies when installing with --production',
  (): Promise<void> => {
    // revealed https://github.com/yarnpkg/yarn/issues/2263
    return runInstall({production: true}, 'prod-should-keep-subdeps', async (config) => {
      // would be hoisted from gulp/vinyl-fs/glob-stream/minimatch/brace-expansion/balanced-match
      expect(await getPackageVersion(config, 'balanced-match')).toEqual('0.4.2');
    });
  });

// https://github.com/yarnpkg/yarn/issues/2470
test.concurrent('a allows dependency with [] in os cpu requirements',
  (): Promise<void> => {
    return runInstall({}, 'empty-os', async (config) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'feed'))).toEqual(true);
    });
  });

test.concurrent('should skip integrity check and do install when --skip-integrity-check flag is passed',
  (): Promise<void> => {
    return runInstall({}, 'skip-integrity-check', async (config, reporter) => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(true);
      await fs.unlink(path.join(config.cwd, 'node_modules', 'sub-dep'));

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

      let reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();

      // reinstall will be successful but it won't reinstall anything
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(false);

      reinstall = new Install({skipIntegrityCheck: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();

      // reinstall will reinstall deps
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(true);

      let newLockContent = await fs.readFile(
        path.join(config.cwd, 'yarn.lock'),
      );
      expect(lockContent).toEqual(newLockContent);

      reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();

      // force rewrites lockfile
      newLockContent = await fs.readFile(
        path.join(config.cwd, 'yarn.lock'),
      );
      expect(lockContent).not.toEqual(newLockContent);

    });
  });

test.concurrent(
  'should install if symlink source does not exist',
  async (): Promise<void> => {
    await runInstall({}, 'relative-symlinks-work', () => {});
  });

test.concurrent('prunes the offline mirror after pruning is enabled', (): Promise<void> => {
  return runInstall({}, 'prune-offline-mirror', async (config): Promise<void> => {
    const mirrorPath = 'mirror-for-offline';
    // Scenario:
    // dep-a 1.0.0 was originally installed, and it depends on dep-b 1.0.0, so
    // both of these were added to the offline mirror. Then dep-a was upgraded
    // to 1.1.0 which doesn't depend on dep-b. After this, pruning was enabled,
    // so the next install should remove dep-a-1.0.0.tgz and dep-b-1.0.0.tgz.
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-b-1.0.0.tgz`))).toEqual(false);
  });
});

test.concurrent('bailout should work with --production flag too', (): Promise<void> => {
  return runInstall({production: true}, 'bailout-prod', async (config, reporter): Promise<void> => {
    // remove file
    await fs.unlink(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'));
    // run install again
    const reinstall = new Install({production: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    // don't expect file being recreated because install should have bailed out
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'))).toBe(false);
  });
});
