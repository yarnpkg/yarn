/* @flow */

import {run as check} from '../../../src/cli/commands/check.js';
import * as constants from '../../../src/constants.js';
import * as reporters from '../../../src/reporters/index.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile';
import * as fs from '../../../src/util/fs.js';
import {getPackageVersion, isPackagePresent, runInstall} from '../_helpers.js';
import {promisify} from '../../../src/util/promise';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const fsNode = require('fs');
const path = require('path');
const os = require('os');

test('does fetch files from the local filesystem', (): Promise<void> => {
  return runInstall(
    {},
    'install-should-fetch-local-tarballs',
    (config): Promise<void> => {
      return Promise.resolve();
    },
    async cwd => {
      let packageJson = await fs.readFile(`${cwd}/package.json`);
      packageJson = packageJson.replace(/%%CWD%%/g, cwd.replace(/\\/g, `/`));
      await fs.writeFile(`${cwd}/package.json`, packageJson);
    },
  );
});

test.concurrent("doesn't write new lockfile if existing one satisfied", (): Promise<void> => {
  return runInstall({}, 'install-dont-write-lockfile-if-satisfied', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockfile.indexOf('foobar')).toBeGreaterThanOrEqual(0);
  });
});

test.concurrent("writes new lockfile if existing one isn't satisfied", async (): Promise<void> => {
  await runInstall({}, 'install-write-lockfile-if-not-satisfied', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockfile.indexOf('foobar')).toEqual(-1);
  });
});

test.concurrent('writes a lockfile when there are no dependencies', (): Promise<void> => {
  return runInstall({}, 'install-without-dependencies', async config => {
    const lockfileExists = await fs.exists(path.join(config.cwd, 'yarn.lock'));
    const installedDepFiles = await fs.walk(path.join(config.cwd, 'node_modules'));

    expect(lockfileExists).toEqual(true);
    // 1 for integrity file (located in node_modules)
    expect(installedDepFiles).toHaveLength(1);
  });
});

test.concurrent("throws an error if existing lockfile isn't satisfied with --frozen-lockfile", async (): Promise<
  void,
> => {
  const reporter = new reporters.ConsoleReporter({});

  let thrown = false;
  try {
    await runInstall({frozenLockfile: true}, 'install-throws-error-if-not-satisfied-and-frozen-lockfile', () => {});
  } catch (err) {
    thrown = true;
    expect(err.message).toContain(reporter.lang('frozenLockfileError'));
  }
  expect(thrown).toEqual(true);
});

test.concurrent(
  "doesn't write new lockfile if existing one satisfied but not fully optimized with --frozen-lockfile",
  (): Promise<void> => {
    return runInstall(
      {frozenLockfile: true},
      'install-should-not-write-lockfile-if-not-optimized-and-frozen',
      async (config): Promise<void> => {
        const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
        expect(lockfile.indexOf('left-pad@1.1.3:')).toBeGreaterThanOrEqual(0);
      },
    );
  },
);

test.concurrent('install transitive optional dependency from lockfile', (): Promise<void> => {
  return runInstall({}, 'install-optional-dep-from-lockfile', (config, reporter, install) => {
    expect(install && install.resolver && install.resolver.patterns['fsevents@^1.0.0']).toBeTruthy();
  });
});

test.concurrent('root install from shrinkwrap', (): Promise<void> => {
  return runInstall({}, 'root-install-with-lockfile');
});

test.concurrent('install have a clean node_modules after lockfile update (branch switch scenario)', (): Promise<
  void,
> => {
  // A@1 -> B@1
  // B@2

  // after package.json/lock file update

  // A@1.2 -> B@1.2

  // (deduped)

  // A@1.2
  // B@1.2

  return runInstall({}, 'install-should-cleanup-when-package-json-changed', async (config, reporter): Promise<void> => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-a/dep-b')).toEqual('1.0.0');

    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(config.cwd, 'yarn.lock.after'), path.join(config.cwd, 'yarn.lock'), reporter);
    await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.2.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.2.0');
  });
});

test.concurrent('install have a clean node_modules after lockfile update (branch switch scenario 2)', (): Promise<
  void,
> => {
  // A@1 -> B@1

  // after package.json/lock file update

  // A@1.2

  return runInstall({}, 'install-should-cleanup-when-package-json-changed-2', async (config, reporter): Promise<
    void,
  > => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');

    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));

    await fs.copy(path.join(config.cwd, 'yarn.lock.after'), path.join(config.cwd, 'yarn.lock'), reporter);
    await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.2.0');
    expect(await isPackagePresent(config, 'dep-b')).toEqual(false);
  });
});

test.concurrent('install should write and read integrity file based on lockfile entries', (): Promise<void> => {
  return runInstall({}, 'lockfile-stability', async (config, reporter) => {
    let lockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockContent += `
# changed the file, integrity should be fine
    `;
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockContent);
    let allCorrect = true;
    try {
      await check(config, reporter, {integrity: true}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);
    // install should bail out with integrity check
    await fs.unlink(path.join(config.cwd, 'node_modules', 'mime-types'));
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

test.concurrent('install should retain artifacts when missing integrity file', (): Promise<void> => {
  return runInstall({}, 'install-should-retain-artifacts-when-missing-integrity', async (config, reporter) => {
    const expectedArtifacts = ['foo.txt'];
    const integrityLoc = path.join(config.cwd, 'node_modules', constants.INTEGRITY_FILENAME);

    const beforeIntegrity = await fs.readJson(integrityLoc);
    expect(beforeIntegrity.artifacts['a@0.0.0']).toEqual(expectedArtifacts);

    await fs.unlink(integrityLoc);

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    const afterIntegrity = await fs.readJson(integrityLoc);
    expect(afterIntegrity.artifacts['a@0.0.0']).toEqual(expectedArtifacts);
  });
});

test.concurrent('install should not continue if integrity check passes', (): Promise<void> => {
  return runInstall({}, 'lockfile-stability', async (config, reporter) => {
    await fs.writeFile(path.join(config.cwd, 'node_modules', 'yarn.test'), 'YARN TEST');

    // install should bail out with integrity check and not remove extraneous file
    let reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'yarn.test'))).toBeTruthy();

    await fs.unlink(path.join(config.cwd, 'node_modules', 'yarn.test'));

    reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();

    expect(!await fs.exists(path.join(config.cwd, 'node_modules', 'yarn.test'))).toBeTruthy();
  });
});

test.concurrent('install should not rewrite lockfile with no substantial changes', (): Promise<void> => {
  const fixture = 'lockfile-no-rewrites';

  return runInstall({}, fixture, async (config, reporter) => {
    const originalLockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockContent =
      originalLockContent +
      `
# changed the file, and it should remain changed after force install
    `;
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockContent);

    await fs.unlink(path.join(config.cwd, 'node_modules', constants.INTEGRITY_FILENAME));

    let reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    let newLockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(newLockContent).toEqual(lockContent);

    // force should rewrite lockfile
    reinstall = new Install({force: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    newLockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(newLockContent).not.toEqual(lockContent);
  });
});

test.concurrent('lockfile should be created when missing even if integrity matches', (): Promise<void> => {
  return runInstall({}, 'lockfile-missing', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'yarn.lock'))).toBeTruthy();
  });
});

test.concurrent('install infers line endings from existing win32 lockfile', async (): Promise<void> => {
  await runInstall(
    {},
    'install-infers-line-endings-from-existing-lockfile',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'yarn.lock'), 'utf8');
      expect(lockfile).toMatch(/\r\n/);
      expect(lockfile).not.toMatch(/[^\r]\n/);
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\r\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'yarn.lock'), existingLockfile, 'utf8');
    },
  );
});

test.concurrent('install infers line endings from existing unix lockfile', async (): Promise<void> => {
  await runInstall(
    {},
    'install-infers-line-endings-from-existing-lockfile',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'yarn.lock'), 'utf8');
      expect(lockfile).toMatch(/[^\r]\n/);
      expect(lockfile).not.toMatch(/\r\n/);
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'yarn.lock'), existingLockfile, 'utf8');
    },
  );
});

test.concurrent("install uses OS line endings when lockfile doesn't exist", async (): Promise<void> => {
  await runInstall({}, 'install-infers-line-endings-from-existing-lockfile', async (config): Promise<void> => {
    const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'yarn.lock'), 'utf8');
    expect(lockfile.indexOf(os.EOL)).toBeGreaterThan(0);
  });
});

test.concurrent('install should rewrite lockfile if patterns can be merged', (): Promise<void> => {
  const fixture = 'lockfile-trimmed';

  return runInstall({}, fixture, async (config, reporter) => {
    const lockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockContent).toContain('mime-db@^1.0.0');
    expect(lockContent).not.toContain('https://fakepath.wont.download.com/mime-db/-/mime-db-1.0.0.tgz');
  });
});

test.concurrent("install should fix if lockfile patterns don't match resolved version", (): Promise<void> => {
  const fixture = 'lockfile-fixed';

  return runInstall({}, fixture, async (config, reporter) => {
    const lockContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockContent).not.toContain('mime-db-1.24.0.tgz');
    expect(lockContent).toContain('mime-db-1.23.0.tgz');
    expect(lockContent).not.toContain('left-pad-1.1.3.tgz');
    expect(lockContent).toContain('left-pad-1.1.2.tgz');
  });
});

test.concurrent('install should warn if a conflicting npm package-lock.json exists', (): Promise<void> => {
  const fixture = 'lockfile-conflict-package-lock-json';

  return runInstall({}, fixture, (config, reporter, install, getStdout) => {
    expect(getStdout()).toContain('package-lock.json found');
  });
});

test.concurrent('install should warn if a conflicting npm npm-shrinkwrap.json exists', (): Promise<void> => {
  const fixture = 'lockfile-conflict-npm-shrinkwrap-json';

  return runInstall({}, fixture, (config, reporter, install, getStdout) => {
    expect(getStdout()).toContain('npm-shrinkwrap.json found');
  });
});
