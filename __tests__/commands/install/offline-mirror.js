/* @flow */

import {runInstall, getPackageVersion, explodeLockfile} from '../_helpers.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile';
import {parse} from '../../../src/lockfile';
import * as fs from '../../../src/util/fs.js';

const path = require('path');
const semver = require('semver');

jest.mock('../../../src/util/package-name-utils');
const nameUtils = jest.requireMock('../../../src/util/package-name-utils');
beforeEach(() => {
  // doing one time mock for one test is tricky,
  // found this workaround https://github.com/facebook/jest/issues/2649#issuecomment-360467278
  nameUtils.getSystemParams.mockImplementation(
    jest.requireActual('../../../src/util/package-name-utils').getSystemParams,
  );
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

test.concurrent(
  'install with offline mirror and pack-built-packages setting should not ignore ".npmignore"',
  (): Promise<void> => {
    return runInstall({ignoreScripts: true}, 'install-offline-built-artifacts-no-ignores', async (config, reporter) => {
      // install scripts were not run
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'build', 'build-artifact.so'))).toEqual(
        false,
      );

      // enable packing of built artifacts
      config.packBuiltPackages = true;

      // after first run we observe package side effects
      let reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'build', 'module-a-build.log'))).toEqual(
        true,
      );

      // after second run we observe only package side effects because offline mirror was used
      await fs.unlink(path.join(config.cwd, 'node_modules'));
      reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await reinstall.init();
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'build', 'module-a-build.log'))).toEqual(
        true,
      );
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
  return runInstall({}, 'install-offline-built-artifacts-multiple-platforms', async (config, reporter) => {
    let tgzFiles = await fs.readdir(path.join(config.cwd, 'mirror-for-offline', 'prebuilt'));
    expect(tgzFiles.length).toBe(1);

    // running install with platform 2 (artifacts get rewritten and install scripts rerun)
    await fs.unlink(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'));
    await fs.unlink(path.join(config.cwd, 'module-a-build.log'));
    nameUtils.getSystemParams.mockImplementation(pkg => {
      return `${process.platform}-${process.arch}-22`;
    });
    nameUtils.getPlatformSpecificPackageFilename.mockImplementation(pkg => {
      const normaliseScope = name => (name[0] === '@' ? name.substr(1).replace('/', '-') : name);
      const suffix = `${process.platform}-${process.arch}-22`;
      return `${normaliseScope(pkg.name)}-v${pkg.version}-${suffix}`;
    });

    let reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    tgzFiles = await fs.readdir(path.join(config.cwd, 'mirror-for-offline', 'prebuilt'));

    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(true);
    expect(tgzFiles.length).toBe(2);

    // running install with platform 1 again (no global side effects)
    await fs.unlink(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'));
    await fs.unlink(path.join(config.cwd, 'module-a-build.log'));
    nameUtils.getSystemParams.mockImplementation(
      jest.requireActual('../../../src/util/package-name-utils').getSystemParams,
    );
    nameUtils.getPlatformSpecificPackageFilename.mockImplementation(
      jest.requireActual('../../../src/util/package-name-utils').getPlatformSpecificPackageFilename,
    );

    reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    tgzFiles = await fs.readdir(path.join(config.cwd, 'mirror-for-offline', 'prebuilt'));
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'dep-a', 'module-a-build.log'))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, 'module-a-build.log'))).toEqual(false);
    expect(tgzFiles.length).toBe(2);
  });
});

test('creates the file in the mirror when fetching a git repository', async () => {
  await runInstall({}, 'install-git', async (config, reporter): Promise<void> => {
    const lockfile = await Lockfile.fromDirectory(config.cwd);

    expect(await fs.glob('example-yarn-package.git-*', {cwd: `${config.cwd}/offline-mirror`})).toHaveLength(1);

    await fs.unlink(path.join(config.cwd, 'offline-mirror'));
    await fs.unlink(path.join(config.cwd, 'node_modules'));

    const firstReinstall = new Install({}, config, reporter, lockfile);
    await firstReinstall.init();

    expect(await fs.glob('example-yarn-package.git-*', {cwd: `${config.cwd}/offline-mirror`})).toHaveLength(1);
  });
});

test.concurrent('install from offline mirror', (): Promise<void> => {
  return runInstall({}, 'install-from-offline-mirror', async (config): Promise<void> => {
    const allFiles = await fs.walk(config.cwd);

    expect(
      allFiles.findIndex((file): boolean => {
        return file.relative === path.join('node_modules', 'fake-dependency', 'package.json');
      }),
    ).toBeGreaterThanOrEqual(0);

    expect(
      allFiles.findIndex((file): boolean => {
        return file.relative === path.join('node_modules', '@fakescope', 'fake-dependency', 'package.json');
      }),
    ).toBeGreaterThanOrEqual(0);
  });
});

test.concurrent('install should add missing deps to yarn and mirror (PR import scenario)', (): Promise<void> => {
  return runInstall({}, 'install-import-pr', async config => {
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
    expect(lockFileLines).toHaveLength(14);
    expect(lockFileLines[4].indexOf('mime-db@')).toEqual(0);
    expect(lockFileLines[8].indexOf('mime-types@2.0.0')).toEqual(0);
  });
});

test.concurrent('install should update a dependency to yarn and mirror (PR import scenario 2)', (): Promise<void> => {
  // mime-types@2.0.0 is gets updated to mime-types@2.1.11 via
  // a change in package.json,
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  return runInstall({}, 'install-import-pr-2', async (config, reporter): Promise<void> => {
    expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1')).toEqual(true);

    expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');

    await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.23.0')).toEqual(true);

    expect(await getPackageVersion(config, 'mime-types')).toEqual('2.1.11');

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);

    expect(lockFileLines[0]).toEqual('mime-db@~1.23.0:');
    expect(lockFileLines[2]).toMatch(/resolved "https:\/\/registry\.yarnpkg\.com\/mime-db\/-\/mime-db-/);

    expect(lockFileLines[4]).toEqual('mime-types@2.1.11:');
    expect(lockFileLines[6]).toMatch(
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

test.concurrent('offline mirror can be enabled from parent dir', (): Promise<void> => {
  const fixture = {
    source: 'offline-mirror-configuration',
    cwd: 'enabled-from-parent',
  };
  return runInstall({}, fixture, async (config, reporter) => {
    const rawLockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const {object: lockfile} = parse(rawLockfile);
    expect(lockfile['mime-types@2.1.14'].resolved).toEqual(
      'https://registry.yarnpkg.com/mime-types/-/mime-types-2.1.14.tgz#f7ef7d97583fcaf3b7d282b6f8b5679dab1e94ee',
    );
    expect(await fs.exists(path.join(config.cwd, '../offline-mirror/mime-types-2.1.14.tgz'))).toBe(true);
  });
});

test.concurrent('offline mirror can be enabled from parent dir, with merging of own .yarnrc', (): Promise<void> => {
  const fixture = {
    source: 'offline-mirror-configuration',
    cwd: 'enabled-from-parent-merge',
  };
  return runInstall({}, fixture, async (config, reporter) => {
    const rawLockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const {object: lockfile} = parse(rawLockfile);
    expect(lockfile['mime-types@2.1.14'].resolved).toEqual(
      'https://registry.yarnpkg.com/mime-types/-/mime-types-2.1.14.tgz#f7ef7d97583fcaf3b7d282b6f8b5679dab1e94ee',
    );
    expect(await fs.exists(path.join(config.cwd, '../offline-mirror/mime-types-2.1.14.tgz'))).toBe(true);
  });
});

test.concurrent('offline mirror can be disabled locally', (): Promise<void> => {
  const fixture = {
    source: 'offline-mirror-configuration',
    cwd: 'disabled-locally',
  };
  return runInstall({}, fixture, async (config, reporter) => {
    const rawLockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const {object: lockfile} = parse(rawLockfile);
    expect(lockfile['mime-types@2.1.14'].resolved).toEqual(
      'https://registry.yarnpkg.com/mime-types/-/mime-types-2.1.14.tgz#f7ef7d97583fcaf3b7d282b6f8b5679dab1e94ee',
    );
    expect(await fs.exists(path.join(config.cwd, '../offline-mirror/mime-types-2.1.14.tgz'))).toBe(false);
  });
});

test.concurrent('prunes the offline mirror tarballs after pruning is enabled', (): Promise<void> => {
  return runInstall({}, 'prune-offline-mirror', async (config): Promise<void> => {
    const mirrorPath = 'mirror-for-offline';
    // Scenario:
    // dep-a 1.0.0 was originally installed, and it depends on dep-b 1.0.0, so
    // both of these were added to the offline mirror. Then dep-a was upgraded
    // to 1.1.0 which doesn't depend on dep-b. After this, pruning was enabled,
    // so the next install should remove dep-a-1.0.0.tgz and dep-b-1.0.0.tgz.
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-b-1.0.0.tgz`))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dummy.txt`))).toEqual(true);
  });
});

test.concurrent('scoped packages remain in offline mirror after pruning is enabled', (): Promise<void> => {
  return runInstall({}, 'prune-offline-mirror-scoped', async (config): Promise<void> => {
    const mirrorPath = 'mirror-for-offline';
    // scoped package exists
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/@fakescope-fake-dependency-1.0.1.tgz`))).toEqual(true);
    // unscoped package exists
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/fake-dependency-1.0.1.tgz`))).toEqual(true);
  });
});
