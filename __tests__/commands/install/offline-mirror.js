/* @flow */

import {runInstall} from '../_helpers.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile';
import * as fs from '../../../src/util/fs.js';

const path = require('path');

jest.mock('../../../src/util/package-name-utils');
const nameUtils = jest.requireMock('../../../src/util/package-name-utils');
beforeEach(() => {
  // doing one time mock for one test is tricky,
  // found this workaround https://github.com/facebook/jest/issues/2649#issuecomment-360467278
  nameUtils.getPlatformSpecificPackageFilename.mockImplementation(
    jest.requireActual('../../../src/util/package-name-utils').getPlatformSpecificPackageFilename,
  );
});

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

test.concurrent(
  'install with offline mirror and pack-built-packages setting should run install' +
    ' scripts on first call and not run on second while producing the same node_modules',
  (): Promise<void> => {
    return runInstall({ignoreScripts: true}, 'install-offline-built-artifacts', async (config, reporter) => {
      // install scripts were not run
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(false);
      expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(false);

      // enable packing of built artifacts
      config.packBuiltPackages = true;

      // after first run we observe both package and global side effects
      let reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(true);

      // after second run we observe only package side effects because offline mirror was used
      await fs.unlink(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'));
      await fs.unlink(path.join(config.cwd, 'module-a-build.log'));
      reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(false);
    });
  },
);

test.concurrent('install without pack-built-packages should keep running install scripts', (): Promise<void> => {
  return runInstall({ignoreScripts: true}, 'install-offline-built-artifacts', async (config, reporter) => {
    // install scripts were not run
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(false);

    // after first run we observe both package and global side effects
    let reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(true);

    // after second run we observe both package and global side effects
    await fs.unlink(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'));
    await fs.unlink(path.join(config.cwd, 'module-a-build.log'));
    reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(true);
  });
});

test.concurrent('removing prebuilt package .tgz file falls back to running scripts', (): Promise<void> => {
  return runInstall({ignoreScripts: true}, 'install-offline-built-artifacts', async (config, reporter) => {
    // install scripts were not run
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(false);

    // enable packing of built artifacts
    config.packBuiltPackages = true;

    // after first run we observe both package and global side effects
    let reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(true);

    // after second run we observe both package and global side effects
    const tgzFiles = await fs.readdir(path.join(config.cwd, 'mirror-for-offline', 'prebuilt'));
    const packageTgz = tgzFiles.filter(f => f !== 'dep-a-v1.0.0.tgz')[0];
    await fs.unlink(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'));
    await fs.unlink(path.join(config.cwd, 'module-a-build.log'));
    await fs.unlink(path.join(config.cwd, 'mirror-for-offline', 'prebuilt', packageTgz));

    reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(true);
  });
});

// This test is not run concurrently because we mock some internal module
test('switching platform for installed node_modules should trigger rebuild / using another prebuilt tgz', (): Promise<
  void,
> => {
  // TODO force not needed lockfile needs to save when prebuilt components get added
  return runInstall({force: true}, 'install-offline-built-artifacts-multiple-platforms', async (config, reporter) => {
    let tgzFiles = await fs.readdir(path.join(config.cwd, 'mirror-for-offline', 'prebuilt'));
    expect(tgzFiles.length).toBe(1);

    // running install with platform 2 (artifacts get rewritten and install scripts rerun)
    await fs.unlink(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'));
    await fs.unlink(path.join(config.cwd, 'module-a-build.log'));
    nameUtils.getPlatformSpecificPackageFilename.mockImplementation(pkg => {
      const normaliseScope = name => (name[0] === '@' ? name.substr(1).replace('/', '-') : name);
      const suffix = `${process.platform}-${process.arch}-22`;
      return `${normaliseScope(pkg.name)}-v${pkg.version}-${suffix}`;
    });

    // TODO force not needed invalidate .yarn-integrity based on platform
    let reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    tgzFiles = await fs.readdir(path.join(config.cwd, 'mirror-for-offline', 'prebuilt'));
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(true);
    expect(tgzFiles.length).toBe(2);

    // runinng install with platform 1 again (no global side effects)
    await fs.unlink(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'));
    await fs.unlink(path.join(config.cwd, 'module-a-build.log'));
    nameUtils.getPlatformSpecificPackageFilename.mockImplementation(
      jest.requireActual('../../../src/util/package-name-utils').getPlatformSpecificPackageFilename,
    );

    // TODO force not needed invalidate .yarn-integrity based on platform
    reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    tgzFiles = await fs.readdir(path.join(config.cwd, 'mirror-for-offline', 'prebuilt'));
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(false);
    expect(tgzFiles.length).toBe(2);
  });
});
