/* @flow */

import Config from '../../../src/config';
import PackageResolver from '../../../src/package-resolver.js';
import {run as add} from '../../../src/cli/commands/add.js';
import {run as cache} from '../../../src/cli/commands/cache.js';
import {run as check} from '../../../src/cli/commands/check.js';
import * as constants from '../../../src/constants.js';
import * as reporters from '../../../src/reporters/index.js';
import {Install, run as install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile';
import * as fs from '../../../src/util/fs.js';
import * as misc from '../../../src/util/misc.js';
import {getPackageVersion, explodeLockfile, runInstall, runLink, createLockfile, run as buildRun} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

let request = require('request');
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

test('install should not copy the .bin folders from the cache', () =>
  runInstall({}, 'install-no-bin', async config => {
    expect(await fs.exists(`${config.cwd}/node_modules/is-pnp/.bin`)).toEqual(false);
  }));

test('install should not hoist packages above their peer dependencies', () =>
  runInstall({}, 'install-should-not-hoist-through-peer-deps', async config => {
    expect(await fs.exists(`${config.cwd}/node_modules/a/node_modules/c`)).toEqual(true);
  }));

test('install should resolve peer dependencies from same subtrees', () =>
  runInstall({}, 'peer-dep-same-subtree', async config => {
    expect(JSON.parse(await fs.readFile(`${config.cwd}/node_modules/d/node_modules/a/package.json`)).version).toEqual(
      '1.0.0',
    );
    expect(JSON.parse(await fs.readFile(`${config.cwd}/node_modules//a/package.json`)).version).toEqual('1.1.0');
    expect(fs.exists(`${config.cwd}/node_modules/c/node_modules/a`)).resolves.toEqual(false);
  }));

test('install optional subdependencies by default', () =>
  runInstall({}, 'install-optional-dependencies', config => {
    expect(fs.exists(`${config.cwd}/node_modules/dep-b`)).resolves.toEqual(true);
  }));

test('installing with --ignore-optional should not install optional subdependencies', () =>
  runInstall({ignoreOptional: true}, 'install-optional-dependencies', config => {
    expect(fs.exists(`${config.cwd}/node_modules/dep-b`)).resolves.toEqual(false);
    expect(fs.exists(`${config.cwd}/node_modules/dep-c`)).resolves.toEqual(true);
    expect(fs.exists(`${config.cwd}/node_modules/dep-d`)).resolves.toEqual(true);
    expect(fs.exists(`${config.cwd}/node_modules/dep-e`)).resolves.toEqual(true);
  }));

test('running install inside a workspace should run the install from the root of the workspace', () =>
  runInstall({}, 'install-workspaces', async (config, reporter): Promise<void> => {
    const pkgJson = await fs.readJson(`${config.cwd}/workspace/package.json`);
    pkgJson.dependencies['b'] = 'file:../b';
    await fs.writeFile(`${config.cwd}/workspace/package.json`, JSON.stringify(pkgJson));

    const workspaceConfig = await Config.create({cwd: `${config.cwd}/workspace`}, reporter);

    const reInstall = new Install({}, workspaceConfig, reporter, await Lockfile.fromDirectory(config.cwd));
    await reInstall.init();

    const lockfileContent = await fs.readFile(`${config.cwd}/yarn.lock`);
    expect(lockfileContent).toEqual(expect.stringContaining(`"b@file:b"`));
    expect(lockfileContent).toEqual(expect.stringContaining(`"a@file:./a"`));
  }));

test('packages installed through the link protocol should validate all peer dependencies', () =>
  runInstall({checkFiles: true}, 'check-files-should-not-cross-symlinks', async config => {
    expect(
      JSON.parse(await fs.readFile(`${config.cwd}/node_modules/.yarn-integrity`)).files.map(file =>
        file.replace(/\\/g, '/'),
      ),
    ).toEqual(['some-missing-pkg', 'some-other-pkg', 'some-pkg/package.json']);
  }));

test('installing a package with a renamed file should not delete it', () =>
  runInstall({}, 'case-sensitivity', async (config, reporter): Promise<void> => {
    const pkgJson = await fs.readJson(`${config.cwd}/package.json`);
    pkgJson.dependencies['pkg'] = 'file:./pkg-b';
    await fs.writeFile(`${config.cwd}/package.json`, JSON.stringify(pkgJson));

    const reInstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reInstall.init();

    expect(await fs.exists(`${config.cwd}/node_modules/pkg/state.js`)).toEqual(true);
  }));

test("installing a tree shouldn't remove preexisting cache directories", () =>
  runInstall({}, 'cache-folder-nm', async (config, reporter): Promise<void> => {
    expect(await fs.exists(`${config.cwd}/node_modules/.cache/hello.txt`)).toEqual(true);

    const reInstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reInstall.init();

    expect(await fs.exists(`${config.cwd}/node_modules/.cache/hello.txt`)).toEqual(true);
  }));

test("installing a new package should correctly update it, even if the files mtime didn't change", () =>
  runInstall({}, 'mtime-same', async (config, reporter): Promise<void> => {
    await misc.sleep(2000);

    const pkgJson = await fs.readJson(`${config.cwd}/package.json`);
    pkgJson.dependencies['pkg'] = 'file:./pkg-b.tgz';
    await fs.writeFile(`${config.cwd}/package.json`, JSON.stringify(pkgJson));

    const reInstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reInstall.init();

    expect(await fs.readJson(`${config.cwd}/node_modules/pkg/package.json`)).toMatchObject({version: '2.0.0'});
  }));

test('properly find and save build artifacts', () =>
  runInstall({}, 'artifacts-finds-and-saves', async config => {
    const integrity = await fs.readJson(path.join(config.cwd, 'node_modules', constants.INTEGRITY_FILENAME));

    expect(integrity.artifacts['dummy@0.0.0']).toEqual(['dummy', path.join('dummy', 'dummy.txt'), 'dummy.txt']);

    // retains artifact
    const moduleFolder = path.join(config.cwd, 'node_modules', 'dummy');
    expect(fs.readFile(path.join(moduleFolder, 'dummy.txt'))).resolves.toEqual('foobar');
    expect(fs.readFile(path.join(moduleFolder, 'dummy', 'dummy.txt'))).resolves.toEqual('foobar');
  }));

test('reading a lockfile should not optimize it', () =>
  runInstall({}, 'lockfile-optimization', async (config, reporter): Promise<void> => {
    const was = await fs.readFile(`${__dirname}/../../fixtures/install/lockfile-optimization/yarn.lock`);
    const is = await fs.readFile(`${config.cwd}/yarn.lock`);

    expect(is).toEqual(was);
  }));

test('creates a symlink to a directory when using the link: protocol', () =>
  runInstall({}, 'install-link', async config => {
    const expectPath = path.join(config.cwd, 'node_modules', 'test-absolute');

    const stat = await fs.lstat(expectPath);
    expect(stat.isSymbolicLink()).toEqual(true);

    const target = await fs.readlink(expectPath);
    expect(path.resolve(config.cwd, target)).toMatch(/[\\\/]bar$/);
  }));

test('creates a symlink to a non-existing directory when using the link: protocol', () =>
  runInstall({}, 'install-link', async config => {
    const expectPath = path.join(config.cwd, 'node_modules', 'test-missing');

    const stat = await fs.lstat(expectPath);
    expect(stat.isSymbolicLink()).toEqual(true);

    const target = await fs.readlink(expectPath);
    if (process.platform !== 'win32') {
      expect(target).toEqual('../baz');
    } else {
      expect(target).toMatch(/[\\\/]baz[\\\/]$/);
    }
  }));

test('resolves the symlinks relative to the package path when using the link: protocol; not the node_modules', () =>
  runInstall({}, 'install-link', async config => {
    const expectPath = path.join(config.cwd, 'node_modules', 'test-relative');

    const stat = await fs.lstat(expectPath);
    expect(stat.isSymbolicLink()).toEqual(true);

    const target = await fs.readlink(expectPath);
    if (process.platform !== 'win32') {
      expect(target).toEqual('../bar');
    } else {
      expect(target).toMatch(/[\\\/]bar[\\\/]$/);
    }
  }));

test('resolves the symlinks of other symlinked packages relative to the package using the link: protocol', () =>
  runInstall({}, 'install-link-nested', async config => {
    const expectPath = path.join(config.cwd, 'node_modules', 'b');

    const stat = await fs.lstat(expectPath);
    expect(stat.isSymbolicLink()).toEqual(true);

    const target = await fs.readlink(expectPath);
    if (process.platform !== 'win32') {
      expect(target).toEqual('../a/b');
    } else {
      expect(target).toMatch(/[\\\/]b[\\\/]$/);
    }
  }));

test('replace the symlink when it changes, when using the link: protocol', () =>
  runInstall({}, 'install-link', async (config, reporter): Promise<void> => {
    const lockfile = await Lockfile.fromDirectory(config.cwd);

    const pkgJson = await fs.readJson(`${config.cwd}/package.json`);
    pkgJson.dependencies['test-missing'] = 'link:barbaz';
    await fs.writeFile(`${config.cwd}/package.json`, JSON.stringify(pkgJson));

    const reInstall = new Install({}, config, reporter, lockfile);
    await reInstall.init();

    const expectPath = path.join(config.cwd, 'node_modules', 'test-missing');

    const stat = await fs.lstat(expectPath);
    expect(stat.isSymbolicLink()).toEqual(true);

    const target = await fs.readlink(expectPath);
    if (process.platform !== 'win32') {
      expect(target).toEqual('../barbaz');
    } else {
      expect(target).toMatch(/[\\\/]barbaz[\\\/]$/);
    }
  }));

test('changes the cache path when bumping the cache version', () =>
  runInstall({}, 'install-github', async config => {
    const inOut = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: inOut});

    await cache(config, reporter, {}, ['dir']);
    expect((JSON.parse(String(inOut.read())): any).data).toMatch(/[\\\/]v(?!42[\\\/]?$)[0-9]+[\\\/]?$/);

    await mockConstants(config, {CACHE_VERSION: 42}, async config => {
      await cache(config, reporter, {}, ['dir']);
      expect((JSON.parse(String(inOut.read())): any).data).toMatch(/[\\\/]v42([\\\/].*)?$/);
    });
  }));

test('changes the cache directory when bumping the cache version', () =>
  runInstall({}, 'install-production', async (config, reporter): Promise<void> => {
    const lockfile = await Lockfile.fromDirectory(config.cwd);

    const resolver = new PackageResolver(config, lockfile);
    await resolver.init([{pattern: 'is-array', registry: 'npm'}]);

    const ref = resolver.getManifests()[0]._reference;
    const cachePath = config.generateModuleCachePath(ref);

    await fs.writeFile(path.join(cachePath, 'yarn.test'), 'YARN TEST');
    await fs.unlink(path.join(config.cwd, 'node_modules'));

    const firstReinstall = new Install({skipIntegrityCheck: true}, config, reporter, lockfile);
    await firstReinstall.init();

    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'is-array', 'yarn.test'))).toEqual(true);

    await mockConstants(config, {CACHE_VERSION: 42}, async config => {
      const secondReinstall = new Install({skipIntegrityCheck: true}, config, reporter, lockfile);
      await secondReinstall.init();

      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'is-array', 'yarn.test'))).toEqual(false);
    });
  }));

test("removes extraneous files that aren't in module or artifacts", () => {
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

  return runInstall(
    {},
    'artifacts-finds-and-saves',
    async config => {
      await check(config.cwd);

      await create(config.cwd);

      // run install again
      const install = new Install({force: true}, config, config.reporter, new Lockfile());
      await install.init();

      await check(config.cwd);
    },
    create,
  );
});

test("production mode with deduped dev dep shouldn't be removed", () =>
  runInstall({production: true}, 'install-prod-deduped-dev-dep', async config => {
    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version).toEqual('1.0.0');

    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version).toEqual('1.0.0');

    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'b'))).toEqual(false);
  }));

test("production mode dep on package in dev deps shouldn't be removed", () =>
  runInstall({production: true}, 'install-prod-deduped-direct-dev-dep', async config => {
    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version).toEqual('1.0.0');

    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'b', 'package.json'))).version).toEqual('1.0.0');

    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version).toEqual('1.0.0');
  }));

test('hoisting should factor ignored dependencies', async () => {
  // you should only modify this test if you know what you're doing
  // when we calculate hoisting we need to factor in ignored dependencies in it
  // so we get deterministic hoisting across environments, for example in production mode
  // we should still be taking dev dependencies into consideration

  async function checkNormal(config): Promise<void> {
    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'a', 'package.json'))).version).toEqual('1.0.0');

    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'd', 'package.json'))).version).toEqual('1.0.0');

    expect(
      (await fs.readJson(path.join(config.cwd, 'node_modules', 'd', 'node_modules', 'c', 'package.json'))).version,
    ).toEqual('2.0.0');
  }

  await runInstall({}, 'install-ignored-retains-hoisting-structure', async config => {
    await checkNormal(config);

    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'b', 'package.json'))).version).toEqual('3.0.0');

    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'c', 'package.json'))).version).toEqual('5.0.0');
  });

  await runInstall({production: true}, 'install-ignored-retains-hoisting-structure', async config => {
    await checkNormal(config);

    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'b'))).toEqual(false);

    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'c'))).toEqual(false);
  });
});

test('--production flag ignores dev dependencies', () =>
  runInstall({production: true}, 'install-production', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'is-array'))).toEqual(true);
  }));

test('--production flag does not link dev dependency bin scripts', () =>
  runInstall({production: true, binLinks: true}, 'install-production-bin', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'touch'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'rimraf'))).toEqual(true);
  }));

test('root install with optional deps', () => runInstall({}, 'root-install-with-optional-dependency'));

test('install file: protocol with relative paths', () =>
  runInstall({}, 'install-file-relative', async config => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'root-a', 'index.js'))).toEqual('foobar;\n');
  }));

test('install file: protocol without force retains installed package', () =>
  runInstall({}, 'install-file-without-cache', async (config, reporter) => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js'))).toEqual('foo\n');

    await fs.writeFile(path.join(config.cwd, 'comp', 'index.js'), 'bar\n');

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js'))).not.toEqual('bar\n');
  }));

test('install file: protocol with force re-installs local package', () =>
  runInstall({}, 'install-file-without-cache', async (config, reporter) => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js'))).toEqual('foo\n');

    await fs.writeFile(path.join(config.cwd, 'comp', 'index.js'), 'bar\n');

    const reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'comp', 'index.js'))).toEqual('bar\n');
  }));

test('install file: local packages with local dependencies', () =>
  runInstall({}, 'install-file-local-dependency', async (config, reporter) => {
    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'a', 'index.js'))).toEqual('foo;\n');

    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'b', 'index.js'))).toEqual('bar;\n');
  }));

test('install file: install without manifest of dependency', () =>
  runInstall({}, 'install-file-without-manifest', async config => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js'))).toEqual('bar\n');
  }));

test('install file: link file dependencies', () =>
  runInstall({}, 'install-file-link-dependencies', async config => {
    const statA = await fs.lstat(path.join(config.cwd, 'node_modules', 'a'));
    expect(statA.isSymbolicLink()).toEqual(true);

    const statB = await fs.lstat(path.join(config.cwd, 'node_modules', 'b'));
    expect(statB.isSymbolicLink()).toEqual(true);

    const statC = await fs.lstat(path.join(config.cwd, 'node_modules', 'c'));
    expect(statC.isSymbolicLink()).toEqual(true);

    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'a', 'index.js'))).toEqual('foo;\n');

    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'b', 'index.js'))).toEqual('bar;\n');
  }));

test('install file: protocol', () =>
  runInstall({lockfile: false}, 'install-file', async config => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js'))).toEqual('foobar;\n');
  }));

test('install with file: protocol as default', () =>
  runInstall({}, 'install-file-as-default', async (config, reporter, install, getOutput) => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js'))).toEqual('foobar;\n');

    expect(getOutput()).toContain(reporter.lang('implicitFileDeprecated', 'bar'));
  }));

test("don't install with file: protocol as default if target is a file", () =>
  expect(runInstall({lockfile: false}, 'install-file-as-default-no-file')).rejects.toMatchObject({
    message: expect.stringContaining('Couldn\'t find any versions for "foo" that matches "bar"'),
  }));

test("don't install with implicit file: protocol if target does not have package.json", () =>
  expect(runInstall({lockfile: false}, 'install-file-as-default-no-package')).rejects.toMatchObject({
    message: expect.stringContaining('Couldn\'t find any versions for "foo" that matches "bar"'),
  }));

test('install with explicit file: protocol if target does not have package.json', () =>
  runInstall({}, 'install-file-no-package', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'foo', 'bar.js'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'bar', 'bar.js'))).toEqual(true);
  }));

test("don't install with file: protocol as default if target is valid semver", () =>
  runInstall({}, 'install-file-as-default-no-semver', async config => {
    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'package.json')))).toMatchObject({
      name: 'foo',
    });
  }));

test("don't hang when an install script tries to read from stdin", () =>
  runInstall({}, 'install-blocking-script', (_config, _reporter, _install, getStdout) =>
    expect(getStdout()).toMatch(/Building fresh packages/),
  ));

// When local packages are installed, dependencies with different forms of the same relative path
// should be deduped e.g. 'file:b' and 'file:./b'
test('install file: dedupe dependencies 1', () =>
  runInstall({}, 'install-file-dedupe-dependencies-1', async config => {
    // Check that b is not added as a sub-dependency of a
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'a', 'node_modules'))).toEqual(false);
  }));

// When local packages are installed, dependencies with relative and absolute paths should be
// deduped e.g. 'file:b' and 'file:/absolute/path/to/b'
test('install file: dedupe dependencies 2', () =>
  runInstall({}, 'install-file-dedupe-dependencies-2', async (config, reporter) => {
    // Add b as a dependency, using an absolute path
    await add(config, reporter, {}, [`b@file:${path.resolve(config.cwd, 'b')}`]);

    // Check that b is not added as a sub-dependency of a
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'a', 'node_modules'))).toEqual(false);
  }));

// When local packages are installed from a repo with a lockfile, the multiple packages
// unpacking in the same location warning should not occur
test('install file: dedupe dependencies 3', () =>
  runInstall({}, 'install-file-dedupe-dependencies-3', (config, reporter, install, getStdout) => {
    const stdout = getStdout();
    // Need to check if message is logged, but don't need to check for any specific parameters
    // so splitting on undefined and testing if all message parts are in stdout
    const messageParts = reporter.lang('multiplePackagesCantUnpackInSameDestination').split('undefined');
    const warningMessage = messageParts.every(part => stdout.includes(part));
    expect(warningMessage).toBe(false);
  }));

test('install everything when flat is enabled', () =>
  runInstall({lockfile: false, flat: true}, 'install-file', async config => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js'))).toEqual('foobar;\n');
  }));

test('install renamed packages', () =>
  runInstall({}, 'install-renamed-packages', async config => {
    const dir = path.join(config.cwd, 'node_modules');

    const json = await fs.readJson(path.join(dir, 'left-pad', 'package.json'));
    expect(json.version).toEqual('1.0.0');

    const json2 = await fs.readJson(path.join(dir, 'left-pad2', 'package.json'));
    expect(json2.version).toEqual('1.1.0');

    const json3 = await fs.readJson(path.join(dir, 'unscoped-turf-helpers', 'package.json'));
    expect(json3.version).toEqual('3.0.16');
    expect(json3.name).toEqual('@turf/helpers');
  }));

test('install from git cache', () =>
  runInstall({}, 'install-from-git-cache', async config => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('0.0.1');
  }));

test('install from github', () => runInstall({}, 'install-github'));

test('check and install should verify integrity in the same way when flat', () =>
  runInstall({flat: true}, 'install-should-dedupe-avoiding-conflicts-1', async (config, reporter) => {
    // Will raise if check doesn't flatten the patterns
    await check(config, reporter, {flat: true, integrity: true}, []);
  }));

test('check should verify that top level dependencies are installed correctly', () =>
  runInstall({}, 'check-top-correct', async (config, reporter) => {
    const pkgDep = JSON.parse(
      await fs.readFile(path.join(config.cwd, 'node_modules/fake-yarn-dependency/package.json')),
    );
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
  }));

test('install should run install scripts in the order of dependencies', () =>
  runInstall({}, 'scripts-order', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a/dep-a-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-b/dep-b-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-c/dep-c-built'))).toBe(true);
  }));

test('install with comments in manifest', () =>
  runInstall({lockfile: false}, 'install-with-comments', async config => {
    expect(await fs.readFile(path.join(config.cwd, 'node_modules', 'foo', 'index.js'))).toEqual('foobar;\n');
  }));

test('install with comments in manifest resolutions does not result in warning', () => {
  const fixturesLoc = path.join(__dirname, '..', '..', 'fixtures', 'install');

  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      await install(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().indexOf(reporter.lang('invalidResolutionName', '//')) > -1;
        }),
      ).toEqual(false);
    },
    [],
    {lockfile: false},
    'install-with-comments',
  );
});

test('install with null versions in manifest', () =>
  runInstall({}, 'install-with-null-version', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad'))).toEqual(true);
  }));

test('run install scripts in the order when one dependency does not have install script', () =>
  runInstall({}, 'scripts-order-with-one-package-missing-install-script', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a/dep-a-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-b/dep-b-built'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-d/dep-d-built'))).toBe(true);
  }));

test('install should circumvent circular dependencies', () =>
  runInstall({}, 'install-should-circumvent-circular-dependencies', async (config, reporter) => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');

    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');

    expect(await getPackageVersion(config, 'dep-c')).toEqual('1.0.0');
  }));

test('install should resolve circular dependencies 2', () =>
  runInstall({}, 'install-should-circumvent-circular-dependencies-2', async (config, reporter) => {
    expect(await getPackageVersion(config, 'es5-ext')).toEqual('0.10.12');
  }));

// Install a package twice
test('install should be idempotent', () =>
  runInstall(
    {},
    'install-should-be-idempotent',
    async (config, reporter) => {
      expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');
      await runInstall({}, 'install-should-be-idempotent', async (config, reporter) => {
        expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');
      });
    },
    null,
  ));

test('install should fail to authenticate integrity with incorrect hash and correct sha512', () =>
  expect(runInstall({}, 'invalid-checksum-good-integrity')).rejects.toMatchObject({
    message: expect.stringContaining("computed integrity doesn't match our records"),
  }));

test('install should authenticate integrity field with sha1 checksums', () =>
  runInstall({}, 'install-update-auth-sha1', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'abab'))).toEqual(true);
    expect(lockFileLines[3].indexOf('integrity sha1-X6rZwsB/YN12dw9xzwJbYqY8/U4=')).toEqual(2);
  }));

test('install should authenticate integrity field with sha512 checksums', () =>
  runInstall({}, 'install-update-auth-sha512', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(
      lockFileLines[3].indexOf(
        'integrity sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg==',
      ),
    ).toEqual(2);
  }));

test('install should authenticate integrity field with sha384 checksums', () =>
  runInstall({}, 'install-update-auth-sha384', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(
      lockFileLines[3].indexOf('integrity sha384-waRmooJr/yhkTilj4++XOO8GFMGUq0RhoiKo7GymDwFU/Ij8vRNGoI7RwAKzyXSM'),
    ).toEqual(2);
  }));

test('install should authenticate integrity field with options', () =>
  runInstall({}, 'install-update-auth-sha512-options', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(
      lockFileLines[3].indexOf(
        'integrity ' +
          'sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg==?foo=bar',
      ),
    ).toEqual(2);
  }));

test('install should authenticate integrity field with combined sha1 and sha512 checksums', () =>
  runInstall({}, 'install-update-auth-combined-sha1-sha512', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    // if this fails on a newer version of node or the ssri module,
    // it (might) mean the sorting algorithm within the sri string changed
    expect(lockFileLines[3]).toMatchSnapshot('integrity stable');
  }));

test('install should authenticate integrity with multiple differing sha1 checksums', () =>
  runInstall({}, 'install-update-auth-multiple-sha1', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines[3].indexOf('integrity "sha1-foo sha1-iTMSr2myEj3vcfV4iQAWce6yyFM=')).toEqual(2);
  }));

test('install should authenticate integrity with multiple differing sha512 checksums', () =>
  runInstall({}, 'install-update-auth-multiple-sha512', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(
      lockFileLines[3].indexOf(
        'integrity "sha512-foo ' +
          'sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg=="',
      ),
    ).toEqual(2);
  }));

test('install should authenticate integrity with wrong sha1 and right sha512 checksums', () =>
  runInstall({}, 'install-update-auth-multiple-wrong-sha1-right-sha512', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(
      lockFileLines[3].indexOf(
        'integrity "sha1-foo ' +
          'sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg=="',
      ),
    ).toEqual(2);
  }));

test('install should fail to authenticate integrity with correct sha1 and incorrect sha512', () =>
  expect(runInstall({}, 'install-update-auth-right-sha1-wrong-sha512')).rejects.toMatchObject({
    message: expect.stringContaining("computed integrity doesn't match our records"),
  }));

test('install should fail to authenticate on sha512 integrity mismatch', () =>
  expect(runInstall({}, 'install-update-auth-wrong-sha512')).rejects.toMatchObject({
    message: expect.stringContaining("computed integrity doesn't match our records"),
  }));

test('install should fail to authenticate on sha1 integrity mismatch', () =>
  expect(runInstall({}, 'install-update-auth-wrong-sha1')).rejects.toMatchObject({
    message: expect.stringContaining("computed integrity doesn't match our records"),
  }));

test.skip('install should create integrity field if not present', () =>
  runInstall({}, 'install-update-auth-no-integrity-field', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(
      lockFileLines[3].indexOf(
        'integrity sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg==',
      ),
    ).toEqual(2);
    expect(lockFileLines[2].indexOf('#893312af69b2123def71f57889001671eeb2c853')).toBeGreaterThan(0);
    // backwards-compatibility
  }),
);

test('install should not create the integrity field if missing and auto-add-integrity is false', () =>
  runInstall({}, 'install-update-auth-no-integrity-field-no-auto-add', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(lockFileLines[2].indexOf('#893312af69b2123def71f57889001671eeb2c853')).toBeGreaterThan(0);
    expect(lockFileLines.length).toEqual(3);
  }));

test('install should not create integrity field if not present and in offline mode', () =>
  runInstall({offline: true}, 'install-update-auth-no-offline-integrity', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'abab'))).toEqual(true);
  }));

test('install should ignore existing hash if integrity is present even if it fails to authenticate it', () =>
  expect(runInstall({}, 'install-update-auth-bad-sha512-good-hash')).rejects.toMatchObject({
    message: expect.stringContaining("computed integrity doesn't match our records"),
  }));

test('install should ignore unknown integrity algorithms if it has other options in the sri', () =>
  runInstall({}, 'install-update-auth-madeup-right-sha512', async config => {
    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'safe-buffer'))).toEqual(true);
    expect(
      lockFileLines[3].indexOf(
        'integrity "madeupalgorithm-abad1dea ' +
          'sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg=="',
      ),
    ).toEqual(2);
  }));

test('install should fail if the only algorithms in the sri are unknown', () =>
  expect(runInstall({}, 'install-update-auth-madeup')).rejects.toMatchObject({
    message: expect.stringContaining('none of the specified algorithms are supported'),
  }));

test('install should fail if the sri is malformed', () =>
  expect(runInstall({}, 'install-update-auth-malformed')).rejects.toMatchObject({
    message: expect.stringContaining('none of the specified algorithms are supported'),
  }));

test('install should fail with unsupported algorithms', () =>
  expect(runInstall({}, 'install-update-auth-sha3')).rejects.toMatchObject({
    message: expect.stringContaining('none of the specified algorithms are supported'),
  }));

test.concurrent('install should update integrity in yarn.lock (--update-checksums)', () =>
  runInstall({updateChecksums: true}, 'install-update-checksums', async config => {
    const lockFileLines = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockFileLines[3]).toEqual(
      expect.stringContaining(
        'sha512-I+Wi+qiE2kUXyrRhNsWv6XsjUTBJjSoVSctKNBfLG5zG/Xe7Rjbxf13+vqYHNTwHaFU+FtSlVxOCTiMEVtPv0A==',
      ),
    );
  }),
);

test.concurrent('install should update malformed integrity string in yarn.lock (--update-checksums)', () =>
  runInstall({updateChecksums: true}, 'install-update-checksums-malformed', async config => {
    const lockFileLines = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockFileLines[3]).toEqual(
      expect.stringContaining(
        'sha512-I+Wi+qiE2kUXyrRhNsWv6XsjUTBJjSoVSctKNBfLG5zG/Xe7Rjbxf13+vqYHNTwHaFU+FtSlVxOCTiMEVtPv0A==',
      ),
    );
  }),
);

if (process.platform !== 'win32') {
  // TODO: This seems like a real issue, not just a config issue
  test('install cache symlinks properly', () =>
    runInstall({}, 'cache-symlinks', async (config, reporter) => {
      const symlink = path.resolve(config.cwd, 'node_modules', 'dep-a', 'link-index.js');
      expect(await fs.exists(symlink)).toBe(true);
      await fs.unlink(path.join(config.cwd, 'node_modules'));

      const lockfile = await createLockfile(config.cwd);
      const install = new Install({}, config, reporter, lockfile);
      await install.init();

      expect(await fs.exists(symlink)).toBe(true);
    }));
}

test('install a scoped module from authed private registry', () =>
  runInstall({}, 'install-from-authed-private-registry', async config => {
    const authedRequests = request.__getAuthedRequests();

    expect(authedRequests[0].url).toEqual('https://registry.yarnpkg.com/@types%2flodash');
    expect(authedRequests[0].headers.authorization).toEqual('Bearer abc123');
    expect(authedRequests[1].url).toEqual('https://registry.yarnpkg.com/@types/lodash/-/lodash-4.14.37.tgz');
    expect(authedRequests[1].headers.authorization).toEqual('Bearer abc123');

    expect(
      (await fs.readFile(path.join(config.cwd, 'node_modules', '@types', 'lodash', 'index.d.ts'))).split('\n')[0],
    ).toEqual('// Type definitions for Lo-Dash 4.14');
  }));

test('install a scoped module from authed private registry with a missing trailing slash', () =>
  runInstall({}, 'install-from-authed-private-registry-no-slash', async config => {
    const authedRequests = request.__getAuthedRequests();

    expect(authedRequests[0].url).toEqual('https://registry.yarnpkg.com/@types%2flodash');
    expect(authedRequests[0].headers.authorization).toEqual('Bearer abc123');
    expect(authedRequests[1].url).toEqual('https://registry.yarnpkg.com/@types/lodash/-/lodash-4.14.37.tgz');
    expect(authedRequests[1].headers.authorization).toEqual('Bearer abc123');

    expect(
      (await fs.readFile(path.join(config.cwd, 'node_modules', '@types', 'lodash', 'index.d.ts'))).split('\n')[0],
    ).toEqual('// Type definitions for Lo-Dash 4.14');
  }));

test('install of scoped package with subdependency conflict should pass check', () =>
  runInstall({}, 'install-scoped-package-with-subdependency-conflict', async (config, reporter) => {
    let allCorrect = true;
    try {
      await check(config, reporter, {integrity: false}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);
  }));

test('install a module with incompatible optional dependency should skip dependency', () =>
  runInstall({}, 'install-should-skip-incompatible-optional-dep', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-incompatible'))).toEqual(false);
  }));

test('install a module with incompatible optional dependency should skip transient dependencies', () =>
  runInstall({}, 'install-should-skip-incompatible-optional-dep', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a'))).toEqual(false);
  }));

test('install a module with optional dependency should skip incompatible transient dependency', () =>
  runInstall({}, 'install-should-skip-incompatible-optional-sub-dep', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-optional'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-incompatible'))).toEqual(false);
  }));

// this tests for a problem occurring due to optional dependency incompatible with os, in this case fsevents
// this would fail on os's incompatible with fsevents, which is everything except osx.
if (process.platform !== 'darwin') {
  test('install incompatible optional dependency should still install shared child dependencies', () =>
    runInstall({}, 'install-should-not-skip-required-shared-deps', async config => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'deep-extend'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'ini'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'strip-json-comments'))).toEqual(true);
    }));
}

test('optional dependency that fails to build should not be installed', () =>
  runInstall({}, 'should-not-install-failing-optional-deps', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-failing'))).toEqual(false);
  }));

test('failing dependency of optional dependency should not be installed', () =>
  runInstall({}, 'should-not-install-failing-deps-of-optional-deps', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-dep'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-failing'))).toEqual(false);
  }));

// Covers current behavior, issue opened whether this should be changed https://github.com/yarnpkg/yarn/issues/2274
test('a subdependency of an optional dependency that fails should be installed', () =>
  runInstall({}, 'should-install-failing-optional-sub-deps', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'optional-failing'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(true);
  }));

test('a sub-dependency should be non-optional if any parents mark it non-optional', () =>
  runInstall({ignoreOptional: true}, 'install-sub-dependency-if-any-parents-mark-it-non-optional', async config => {
    const deps = await fs.readdir(path.join(config.cwd, 'node_modules'));

    expect(deps).toEqual([
      '.yarn-integrity',
      'normal-dep',
      'normal-sub-dep',
      'normal-sub-sub-dep',
      'sub-dep',
      'sub-dep-2',
      'sub-sub-dep',
    ]);
  }));

// revealed https://github.com/yarnpkg/yarn/issues/2263
test('should not loose dependencies when installing with --production', () =>
  runInstall({production: true}, 'prod-should-keep-subdeps', async config => {
    // would be hoisted from gulp/vinyl-fs/glob-stream/minimatch/brace-expansion/balanced-match
    expect(await getPackageVersion(config, 'balanced-match')).toEqual('0.4.2');
  }));

// https://github.com/yarnpkg/yarn/issues/2470
test('a allows dependency with [] in os cpu requirements', () =>
  runInstall({}, 'empty-os', async config => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'feed'))).toEqual(true);
  }));

test('should skip integrity check and do install when --skip-integrity-check flag is passed', () =>
  runInstall({}, 'skip-integrity-check', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(true);
    await fs.unlink(path.join(config.cwd, 'node_modules', 'sub-dep'));

    let lockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockContent += `
# changed the file, integrity should be fine
    `;
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockContent);

    let reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    // reinstall will be successful but it won't reinstall anything
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(false);

    reinstall = new Install({skipIntegrityCheck: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    // reinstall will reinstall deps
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'sub-dep'))).toEqual(true);

    let newLockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockContent).toEqual(newLockContent);

    reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    // force rewrites lockfile
    newLockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockContent).not.toEqual(newLockContent);
  }));

test('bailout should work with --production flag too', () =>
  runInstall({production: true}, 'bailout-prod', async (config, reporter): Promise<void> => {
    // remove file
    await fs.unlink(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'));
    // run install again
    const reinstall = new Install({production: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    // don't expect file being recreated because install should have bailed out
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'))).toBe(false);
  }));

// Scenario:
// graceful-fs will install two versions, from @4.1.10 and @^4.1.11. The pattern @^4.1.2 would sometimes resolve
// to 4.1.10, if @^4.1.11 hadn't been processed before. Otherwise it would resolve to the result of @^4.1.11.
// Run an independent install and check, and see they have different results for @^4.1.2 - won't always see
// the bug, but its the best we can do without creating mock registry with controlled timing of responses.
test('package version resolve should be deterministic', () =>
  runInstall({}, 'install-deterministic-versions', async (config, reporter) => {
    await check(config, reporter, {integrity: true}, []);
  }));

test('transitive file: dependencies should work', () =>
  runInstall({}, 'transitive-file', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'b'))).toBe(true);
  }));

test('unbound transitive dependencies should not conflict with top level dependency', () =>
  runInstall({flat: true}, 'install-conflicts', async config => {
    expect((await fs.readJson(path.join(config.cwd, 'node_modules', 'left-pad', 'package.json'))).version).toEqual(
      '1.0.0',
    );
  }));

test('manifest optimization respects versions with alternation', () =>
  runInstall({flat: true}, 'optimize-version-with-alternation', async config => {
    expect(await getPackageVersion(config, 'lodash')).toEqual('2.4.2');
  }));

test('top level patterns should match after install', () =>
  runInstall({}, 'top-level-pattern-check', async (config, reporter) => {
    let integrityError = false;
    try {
      await check(config, reporter, {integrity: true}, []);
    } catch (err) {
      integrityError = true;
    }
    expect(integrityError).toBe(false);
  }));

test('warns for missing bundledDependencies', () =>
  buildRun(
    reporters.BufferReporter,
    path.join(__dirname, '..', '..', 'fixtures', 'install'),
    async (args, flags, config, reporter): Promise<void> => {
      await install(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return (
            warning.data.toString().indexOf(reporter.lang('missingBundledDependency', 'tap@0.3.1', 'tap-consumer')) > -1
          );
        }),
      ).toEqual(true);
    },
    [],
    {},
    'missing-bundled-dep',
  ));

test('install will not overwrite linked scoped dependencies', () =>
  runInstall({production: true}, 'install-dont-overwrite-linked', async (installConfig): Promise<void> => {
    // link our fake dep to the registry
    await runLink([], {}, 'package-with-name-scoped', async (linkConfig): Promise<void> => {
      // link our fake dependency in our node_modules
      await runLink(
        ['@fakescope/a-package'],
        {linkFolder: linkConfig.linkFolder},
        {cwd: installConfig.cwd},
        async () => {
          // check that it exists (just in case)
          const existed = await fs.exists(path.join(installConfig.cwd, 'node_modules', '@fakescope', 'a-package'));
          expect(existed).toEqual(true);

          // run install to install dev deps which would remove the linked dep if the bug was present
          await runInstall({linkFolder: linkConfig.linkFolder}, {cwd: installConfig.cwd}, async () => {
            // if the linked dep is still there is a win :)
            const existed = await fs.exists(path.join(installConfig.cwd, 'node_modules', '@fakescope', 'a-package'));
            expect(existed).toEqual(true);
          });
        },
      );
    });
  }));

test('install will not overwrite linked dependencies', () =>
  runInstall({production: true}, 'install-dont-overwrite-linked', async (installConfig): Promise<void> => {
    // link our fake dep to the registry
    await runLink([], {}, 'package-with-name', async (linkConfig): Promise<void> => {
      // link our fake dependency in our node_modules
      await runLink(['a-package'], {linkFolder: linkConfig.linkFolder}, {cwd: installConfig.cwd}, async (): Promise<
        void,
      > => {
        // check that it exists (just in case)
        const existed = await fs.exists(path.join(installConfig.cwd, 'node_modules', 'a-package'));
        expect(existed).toEqual(true);

        // run install to install dev deps which would remove the linked dep if the bug was present
        await runInstall({linkFolder: linkConfig.linkFolder}, {cwd: installConfig.cwd}, async () => {
          // if the linked dep is still there is a win :)
          const existed = await fs.exists(path.join(installConfig.cwd, 'node_modules', 'a-package'));
          expect(existed).toEqual(true);
        });
      });
    });
  }));

// There was an issue where anything ending with `.git` would be sent to GitResolver, even if it was a file: dep.
// This caused an error if you had a directory named "myModule.git" and tried to use it with "file:../myModule.git"
// See https://github.com/yarnpkg/yarn/issues/3670
test('file: dependency ending with `.git` should work', () =>
  runInstall({}, 'local-named-git', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'a'))).toBe(true);
  }));

// There was a warning being generated when a peerDep existed at a deeper level, and at the top level.
// See https://github.com/yarnpkg/yarn/issues/4743
//
// package.json
// |- b
// |  |- caniuse-api
// |     |- caniuse-lite
// |- caniuse-lite
//
// When `b` also has a peerDep on `caniuse-lite` then Yarn was issuing a warning that the dep was missing.
test('install will not warn for missing peerDep when both shallower and deeper', () =>
  runInstall({}, 'peer-dep-included-at-2-levels', (config, reporter, install, getStdout) => {
    const stdout = getStdout();
    const messageParts = reporter.lang('unmetPeer').split('undefined');
    const warningMessage = messageParts.every(part => stdout.includes(part));
    expect(warningMessage).toBe(false);
  }));

test('install will warn for missing peer dependencies', () =>
  runInstall({}, 'missing-peer-dep', (config, reporter, install, getStdout) => {
    const stdout = getStdout();
    const messageParts = reporter.lang('unmetPeer', 'undefined').split('undefined');
    const warningMessage = messageParts.every(part => stdout.includes(part));
    expect(warningMessage).toBe(true);
  }));

test('install will not warn for missing optional peer dependencies', () =>
  runInstall({}, 'missing-opt-peer-dep', (config, reporter, install, getStdout) => {
    const stdout = getStdout();
    const messageParts = reporter.lang('unmetPeer', 'undefined').split('undefined');
    const warningMessage = messageParts.every(part => stdout.includes(part));
    expect(warningMessage).toBe(false);
  }));

test('does not check node_modules for extraneous files when --modules-folder used', async () => {
  // Scenario: https://github.com/yarnpkg/yarn/issues/5419
  // When `--modules-foler` is passed, yarn should check that directory for extraneous files.
  // Also, the default node_modules dir, if it exists, should not be cleaned out (marked as extraneous).
  await runInstall({modulesFolder: './some_modules'}, 'extraneous-node-modules', async (config): Promise<void> => {
    expect(await fs.exists(`${config.cwd}/some_modules/feed`)).toEqual(true);
    // Extraneous files in node_modules should not have been cleaned.
    expect(await fs.exists(`${config.cwd}/node_modules/extra.js`)).toEqual(true);
    // Extraneous files in some_modules should have been cleaned.
    expect(await fs.exists(`${config.cwd}/some_modules/extra.js`)).toEqual(false);
  });
});

test('install skips the scripts if the yarnrc specifies skip-scripts true', () =>
  runInstall({}, 'ignore-scripts-by-yarnrc', (config, reporter, install, getStdout) => {
    const stdout = getStdout();

    const ignoredScriptsMessage = reporter.lang('ignoredScripts');
    expect(stdout).toMatch(ignoredScriptsMessage);
  }));

describe('Cache', () => {
  test('install should cache package without integrity prefix if no integrity field present', () =>
    runInstall({}, 'install-update-auth-no-integrity-field', async config => {
      const pkgCacheDir = path.join(
        config.cwd,
        '.yarn-cache',
        `v${constants.CACHE_VERSION}`,
        'npm-safe-buffer-5.1.1-893312af69b2123def71f57889001671eeb2c853',
      );

      expect(await fs.exists(pkgCacheDir)).toEqual(true);
    }));

  test('install should cache package with integrity suffix if integrity field present', () =>
    runInstall({}, 'install-update-auth-sha512', async config => {
      const pkgCacheDir = path.join(
        config.cwd,
        '.yarn-cache',
        `v${constants.CACHE_VERSION}`,
        'npm-safe-buffer-5.1.1-893312af69b2123def71f57889001671eeb2c853-integrity',
      );

      expect(await fs.exists(pkgCacheDir)).toEqual(true);
    }));

  test('install should store cached sha1 + sha512 integrity when lockfile has sha1 integrity field', () =>
    runInstall({}, 'install-update-auth-sha1-safebuffer', async config => {
      const pkgCacheDir = path.join(
        config.cwd,
        '.yarn-cache',
        `v${constants.CACHE_VERSION}`,
        'npm-safe-buffer-5.1.1-893312af69b2123def71f57889001671eeb2c853-integrity',
      );
      const pkgCacheMetaData = JSON.parse(
        await fs.readFile(path.join(pkgCacheDir, 'node_modules', 'safe-buffer', constants.METADATA_FILENAME)),
      );
      expect(pkgCacheMetaData.remote.cacheIntegrity).toBe(
        // eslint-disable-next-line max-len
        'sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg== sha1-iTMSr2myEj3vcfV4iQAWce6yyFM=',
      );
    }));

  test('install should store cached sha1 + sha512 integrity when lockfile has sha512 integrity field', () =>
    runInstall({}, 'install-update-auth-sha512', async config => {
      const pkgCacheDir = path.join(
        config.cwd,
        '.yarn-cache',
        `v${constants.CACHE_VERSION}`,
        'npm-safe-buffer-5.1.1-893312af69b2123def71f57889001671eeb2c853-integrity',
      );
      const pkgCacheMetaData = JSON.parse(
        await fs.readFile(path.join(pkgCacheDir, 'node_modules', 'safe-buffer', constants.METADATA_FILENAME)),
      );
      expect(pkgCacheMetaData.remote.cacheIntegrity).toBe(
        // eslint-disable-next-line max-len
        'sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg== sha1-iTMSr2myEj3vcfV4iQAWce6yyFM=',
      );
    }));

  test('install should store cached sha1 + sha512 integrity when lockfile has no integrity field', () =>
    runInstall({}, 'install-update-auth-no-integrity-field', async config => {
      const pkgCacheDir = path.join(
        config.cwd,
        '.yarn-cache',
        `v${constants.CACHE_VERSION}`,
        'npm-safe-buffer-5.1.1-893312af69b2123def71f57889001671eeb2c853',
      );
      const pkgCacheMetaData = JSON.parse(
        await fs.readFile(path.join(pkgCacheDir, 'node_modules', 'safe-buffer', constants.METADATA_FILENAME)),
      );

      expect(pkgCacheMetaData.remote.cacheIntegrity).toBe(
        // eslint-disable-next-line max-len
        'sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg== sha1-iTMSr2myEj3vcfV4iQAWce6yyFM=',
      );
    }));

  test('install should fail when cached package integrity does not match lockfile integrity field', () =>
    expect(runInstall({}, 'install-update-auth-invalid-cache-integrity')).rejects.toThrow(
      // eslint-disable-next-line max-len
      'Incorrect integrity when fetching from the cache for "safe-buffer". Cache has "sha512-foo sha1-bar" and remote has "sha1-iTMSr2myEj3vcfV4iQAWce6yyFM="',
    ));

  test('install should fail when cached package hash does not match remote hash', () =>
    expect(runInstall({}, 'install-update-auth-invalid-cache-hash')).rejects.toThrow(
      // eslint-disable-next-line max-len
      'Incorrect hash when fetching from the cache for "safe-buffer". Cache has "bad-hash" and remote has "893312af69b2123def71f57889001671eeb2c853"',
    ));

  test('install should not fail cache integrity validation when lockfile has sha1 integrity field', () =>
    expect(runInstall({}, 'install-update-auth-sha1-with-cache')).resolves.toBeUndefined());

  test('install should not fail cache integrity validation when lockfile has sha512 integrity field', () =>
    expect(runInstall({}, 'install-update-auth-sha512-with-cache')).resolves.toBeUndefined());

  test('install should not fail cache integrity validation when lockfile has no integrity field', () =>
    expect(runInstall({}, 'install-update-auth-no-integrity-field-with-cache')).resolves.toBeUndefined());
});
