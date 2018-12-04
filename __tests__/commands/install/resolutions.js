/* @flow */

import {getPackageVersion, isPackagePresent, runInstall} from '../_helpers.js';
import {ConsoleReporter} from '../../../src/reporters/index.js';
import * as fs from '../../../src/util/fs.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');
const semver = require('semver');

test.concurrent('install with simple exact resolutions should override all versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'simple-exact'}, async config => {
    expect(await getPackageVersion(config, 'a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'd1')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'd2')).toEqual('1.0.0');
    expect(await isPackagePresent(config, 'a/d1')).toEqual(false);
    expect(await isPackagePresent(config, 'a/d2')).toEqual(false);
    expect(await isPackagePresent(config, 'b/d1')).toEqual(false);
    expect(await isPackagePresent(config, 'b/d2')).toEqual(false);
  });
});

test.concurrent('install with subtree exact resolutions should override subtree versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'subtree-exact'}, async config => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'd2')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'd2/left-pad')).toEqual('1.1.1');
    expect(await getPackageVersion(config, 'c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'c/left-pad')).toEqual('1.1.2');
  });
});

test.concurrent('install with --frozen-lockfile with resolutions', async (): Promise<void> => {
  const reporter = new ConsoleReporter({});

  try {
    await runInstall({frozenLockfile: true}, {source: 'resolutions', cwd: 'frozen-lockfile'}, async config => {
      expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.3');
    });
  } catch (err) {
    expect(err.message).not.toContain(reporter.lang('frozenLockfileError'));
  }
});

test.concurrent('install with exotic resolutions should override versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'exotic-version'}, async config => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.1');
  });
});

test.concurrent('install with range resolutions should override versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'simple-range'}, async config => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.1');
  });
});
test.concurrent('should warn when resolution entries are incorrrect or incompatible', async (): Promise<void> => {
  let error;

  try {
    await runInstall({}, {source: 'resolutions', cwd: 'invalid-entries'});
  } catch (e) {
    error = e.message;
  }

  expect(error).toContain('Resolution field "left-pad@1.0.0" is incompatible with requested version "left-pad@~1.1.0');
  expect(error).toContain('Resolution field "wrongversion" has an invalid version entry and may be ignored');
  expect(error).toContain('Resolution field "invalidname/" does not end with a valid package name and will be ignored');
});

test.concurrent('install with resolutions should correctly install simple scoped packages', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'scoped-simple'}, async config => {
    expect(await getPackageVersion(config, '@scoped/a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, '@scoped/b')).toEqual('2.0.0');
  });
});

test.concurrent('install with resolutions should correctly install toplevel scoped packages', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'scoped-toplevel'}, async config => {
    expect(await getPackageVersion(config, '@scoped/a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, '@scoped/b')).toEqual('2.0.0');
  });
});

test.concurrent('install with nested resolutions', (): Promise<void> => {
  return runInstall({}, 'install-nested-resolutions', async config => {
    expect(await getPackageVersion(config, 'strip-ansi')).toEqual('2.0.1');
    expect(await getPackageVersion(config, 'ansi-regex')).toEqual('1.1.1');
  });
});

test.concurrent('install with nested resolutions using flat mode', (): Promise<void> => {
  return runInstall({flat: true}, 'install-nested-resolutions', async config => {
    expect(await getPackageVersion(config, 'strip-ansi')).toEqual('2.0.1');
    expect(await getPackageVersion(config, 'ansi-regex')).toEqual('1.1.1');
  });
});

test.concurrent('install with resolution settings should correctly bailout during the integrity check', (): Promise<
  void,
> => {
  return runInstall(
    {},
    {source: 'resolutions', cwd: 'install-with-resolution-should-bailout-during-the-integrity-check'},
    async (config, reporter): Promise<void> => {
      // remove file
      await fs.unlink(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'));
      // run install again
      const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();
      // don't expect file being recreated because install should have bailed out
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'))).toBe(false);
    },
  );
});

test.concurrent('adding resolutions after install should cause lockfile regeneration on second install', (): Promise<
  void,
> => {
  return runInstall(
    {},
    {source: 'resolutions', cwd: 'adding-resolutions-should-cause-lockfile-regeneration'},
    async (config, reporter): Promise<void> => {
      const packageJson = await fs.readFile(path.join(config.cwd, 'package.json'));
      // create new package.json with resolutions which override e/left-pad version
      const newPackageJson = JSON.parse(packageJson);
      newPackageJson.resolutions = {};
      newPackageJson.resolutions['e/left-pad'] = '1.1.1';
      // write new package.json
      await fs.writeFile(path.join(config.cwd, 'package.json'), JSON.stringify(newPackageJson));
      // expect left-pad in e/node_modules to be present and have corrent version
      // since it is not satisfied by top-level dependency
      expect(semver.satisfies(await getPackageVersion(config, 'e/left-pad'), '^1.0.0')).toBe(true);
      // run install again
      const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();
      // don't expect left-pad in e/node_modules since it's now being replaced by single dependency left-pad@1.1.1
      expect(await isPackagePresent(config, 'e/left-pad')).toBe(false);
      const lockfile = await Lockfile.fromDirectory(config.cwd);
      const lockManifest = lockfile.getLocked('left-pad@^1.0.0');
      // check that new version of e/left-pad in lockfile is correctly updated
      expect(lockManifest && lockManifest.version).toEqual('1.1.1');
    },
  );
});
