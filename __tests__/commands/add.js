/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import * as reporters from '../../src/reporters/index.js';
import {
  getPackageVersion,
  createLockfile,
  explodeLockfile,
  run as buildRun,
  runInstall,
  makeConfigFromDirectory,
} from './_helpers.js';
import {Add, run as add} from '../../src/cli/commands/add.js';
import * as constants from '../../src/constants.js';
import {parse} from '../../src/lockfile';
import {Install} from '../../src/cli/commands/install.js';
import Lockfile from '../../src/lockfile';
import {run as check} from '../../src/cli/commands/check.js';
import * as fs from '../../src/util/fs.js';
import semver from 'semver';
import {promisify} from '../../src/util/promise';
import fsNode from 'fs';
import inquirer from 'inquirer';
import invariant from 'invariant';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');
const stream = require('stream');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'add');

const runAdd = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile): Promise<Add> => {
    const add = new Add(args, flags, config, reporter, lockfile);
    await add.init();
    await check(config, reporter, {}, []);
    await check(config, reporter, {verifyTree: true}, []);
    return add;
  },
);

test.concurrent('add without --ignore-workspace-root-check should fail on the workspace root', async () => {
  await runInstall({}, 'simple-worktree', async (config, reporter): Promise<void> => {
    await expect(add(config, reporter, {}, ['left-pad'])).rejects.toBeDefined();
  });
});

test.concurrent("add with --ignore-workspace-root-check shouldn't fail on the workspace root", async () => {
  await runInstall({}, 'simple-worktree', async (config, reporter): Promise<void> => {
    await expect(add(config, reporter, {ignoreWorkspaceRootCheck: true}, ['left-pad'])).resolves.toBeUndefined();
  });
});

test.concurrent('adding to the workspace root should preserve workspace packages in lockfile', async () => {
  await runInstall({}, 'workspaces-install-basic', async (config, reporter): Promise<void> => {
    await add(config, reporter, {ignoreWorkspaceRootCheck: true}, ['max-safe-integer@1.0.0']);

    expect(await fs.exists(`${config.cwd}/yarn.lock`)).toEqual(true);

    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    expect(pkg.dependencies).toEqual({'left-pad': '1.1.3', 'max-safe-integer': '1.0.0'});

    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockfile).toHaveLength(16);
    expect(lockfile.indexOf('isarray@2.0.1:')).toEqual(0);
    expect(lockfile.indexOf('left-pad@1.1.3:')).toEqual(3);
    expect(lockfile.indexOf('max-safe-integer@1.0.0:')).toEqual(6);
  });
});

test.concurrent('adds any new package to the current workspace, but install from the workspace', async () => {
  await runInstall({}, 'simple-worktree', async (config): Promise<void> => {
    const inOut = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: inOut});

    expect(await fs.exists(`${config.cwd}/node_modules/left-pad`)).toEqual(false);
    expect(await fs.exists(`${config.cwd}/packages/package-a/node_modules/left-pad`)).toEqual(false);

    await add(await makeConfigFromDirectory(`${config.cwd}/packages/package-a`, reporter), reporter, {}, ['left-pad']);

    expect(await fs.exists(`${config.cwd}/node_modules/left-pad`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-a/node_modules/left-pad`)).toEqual(false);

    expect(await fs.exists(`${config.cwd}/yarn.lock`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-a/yarn.lock`)).toEqual(false);

    await add(await makeConfigFromDirectory(`${config.cwd}/packages/package-b`, reporter), reporter, {}, ['right-pad']);

    expect(await fs.exists(`${config.cwd}/node_modules/right-pad`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-b/node_modules/right-pad`)).toEqual(false);

    expect(await fs.exists(`${config.cwd}/yarn.lock`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-b/yarn.lock`)).toEqual(false);

    await add(await makeConfigFromDirectory(`${config.cwd}/non-package/package-c`, reporter), reporter, {}, [
      'isarray',
    ]);

    expect(await fs.exists(`${config.cwd}/node_modules/isarray`)).toEqual(false);
    expect(await fs.exists(`${config.cwd}/non-package/package-c/node_modules/isarray`)).toEqual(true);

    expect(await fs.exists(`${config.cwd}/non-package/package-c/yarn.lock`)).toEqual(true);
  });
});

test.concurrent('add creates an entry with a sha512 integrity field', () => {
  return runAdd(['safe-buffer@5.1.1'], {}, 'add-integrity-sha512', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(
      lockfile[3].indexOf(
        'integrity sha512-kKvNJn6Mm93gAczWVJg7wH+wGYWNrDHdWvpUmHyEsgCtIwwo3bqPtV4tR5tuPaUhTOo/kvhVwd8XwwOllGYkbg==',
      ),
    ).toEqual(2);
    expect(lockfile[2].indexOf('#893312af69b2123def71f57889001671eeb2c853"')).toBeGreaterThan(0);
    // backwards compatibility
  });
});

test.concurrent('add creates an entry with a sha1 integrity field when sha512 is unavailable', () => {
  return runAdd(['left-pad@1.1.0'], {}, 'add-integrity-sha1', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockfile[3].indexOf('integrity sha1-R6La9YHt5FQzTe5sYDbK4A2RLk0=')).toEqual(2);
    expect(lockfile[2].indexOf('#47a2daf581ede454334dee6c6036cae00d912e4d')).toBeGreaterThan(0);
    // backwards compatibility
  });
});

test.concurrent('install with arg', async () => {
  await runAdd(['is-online'], {}, 'install-with-arg');
});

test.concurrent('install from github', async () => {
  await runAdd(['substack/node-mkdirp#master'], {}, 'install-github');
});

test.concurrent('install from github with invalid version should fail', async () => {
  let message = '';
  try {
    await runAdd(['yarnpkg/example-yarn-package#invalid-package-json-version'], {}, 'install-github');
  } catch (err) {
    message = err.message;
  }
  expect(message).toEqual(expect.stringContaining('invalid package version'));
});

test.concurrent('install with --dev flag', async () => {
  await runAdd(['left-pad@1.1.0'], {dev: true}, 'add-with-flag', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('left-pad@1.1.0:')).toEqual(0);
    expect(pkg.devDependencies).toEqual({'left-pad': '1.1.0'});
    expect(pkg.dependencies).toEqual({});
  });
});

test.concurrent('install with --peer flag', async () => {
  await runAdd(['left-pad@1.1.0'], {peer: true}, 'add-with-flag', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('left-pad@1.1.0:')).toEqual(0);
    expect(pkg.peerDependencies).toEqual({'left-pad': '1.1.0'});
    expect(pkg.dependencies).toEqual({});
  });
});

test.concurrent('install with --optional flag', async () => {
  await runAdd(['left-pad@1.1.0'], {optional: true}, 'add-with-flag', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('left-pad@1.1.0:')).toEqual(0);
    expect(pkg.optionalDependencies).toEqual({'left-pad': '1.1.0'});
    expect(pkg.dependencies).toEqual({});
  });
});

test.concurrent('install with --tilde flag', (): Promise<void> => {
  return runAdd(['isarray@2.0.1'], {tilde: true}, 'add-with-flag', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('isarray@~2.0.1:')).toEqual(0);
    expect(pkg.dependencies).toEqual({isarray: '~2.0.1'});
  });
});

// Test if moduleAlreadyInManifest warning is displayed
const moduleAlreadyInManifestChecker = ({expectWarnings}: {expectWarnings: boolean}) => async (
  args,
  flags,
  config,
  reporter,
  lockfile,
): Promise<void> => {
  const add = new Add(args, flags, config, reporter, lockfile);
  await add.init();

  const output = reporter.getBuffer();
  const warnings = output.filter(entry => entry.type === 'warning');

  expect(warnings.some(warning => warning.data.toString().toLowerCase().indexOf('is already in') > -1)).toEqual(
    expectWarnings,
  );

  expect(
    warnings.some(
      warning => warning.data.toString().toLowerCase().indexOf('please remove existing entry first before adding') > -1,
    ),
  ).toEqual(expectWarnings);
};

test.concurrent('warns when adding a devDependency as dependency', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    moduleAlreadyInManifestChecker({expectWarnings: true}),
    ['is-online'],
    {},
    'add-already-added-dev-dependency',
  );
});

test.concurrent("doesn't warn when adding a devDependency as devDependency", async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    moduleAlreadyInManifestChecker({expectWarnings: false}),
    ['is-online'],
    {dev: true},
    'add-already-added-dev-dependency',
  );
});

test.concurrent('warns when adding a dependency as devDependency', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    moduleAlreadyInManifestChecker({expectWarnings: true}),
    ['is-online'],
    {dev: true},
    'add-already-added-dependency',
  );
});

test.concurrent("doesn't warn when adding a dependency as dependency", async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    moduleAlreadyInManifestChecker({expectWarnings: false}),
    ['is-online'],
    {},
    'add-already-added-dependency',
  );
});

test.concurrent('install with link: specifier', async () => {
  await runAdd(['link:../left-pad'], {dev: true}, 'add-with-flag', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    const expectPath = path.join(config.cwd, 'node_modules', 'left-pad');

    const stat = await fs.lstat(expectPath);
    expect(stat.isSymbolicLink()).toEqual(true);

    expect(lockfile.indexOf('left-pad@1.1.0:')).toEqual(-1);
    expect(pkg.devDependencies).toEqual({'left-pad': 'link:../left-pad'});
    expect(pkg.dependencies).toEqual({});
  });
});

test.concurrent('install with arg that has binaries', async () => {
  await runAdd(['react-native-cli'], {}, 'install-with-arg-and-bin');
});

test.concurrent('add with no manifest creates blank manifest', async () => {
  await runAdd(['lodash'], {}, 'add-with-no-manifest', async config => {
    expect(await fs.exists(path.join(config.cwd, 'package.json'))).toBe(true);
  });
});

test.concurrent('add should ignore cache', async () => {
  // left-pad@1.1.0 gets installed without --save
  // left-pad@1.1.0 gets installed with --save
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  await runAdd(['left-pad@1.1.0'], {}, 'install-save-to-mirror-when-cached', async (config, reporter) => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.0');

    const lockfile = await createLockfile(config.cwd);

    const install = new Add(['left-pad@1.1.0'], {}, config, reporter, lockfile);
    await install.init();

    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.0');

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'left-pad': '1.1.0',
    });

    const mirror = await fs.walk(path.join(config.cwd, 'mirror-for-offline'));
    expect(mirror).toHaveLength(1);
    expect(mirror[0].relative).toEqual('left-pad-1.1.0.tgz');

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);
    expect(lockFileLines).toHaveLength(4);
    expect(lockFileLines[0]).toEqual('left-pad@1.1.0:');
    expect(lockFileLines[2]).toMatch(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-1\.1\.0\.tgz#[a-f0-9]+"/,
    );
  });
});

test.concurrent('add should not make package.json strict', async () => {
  await runAdd(['left-pad@^1.1.0'], {}, 'install-no-strict', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));

    expect(lockfile.indexOf('left-pad@^1.1.0:')).toBeGreaterThanOrEqual(0);
    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'left-pad': '^1.1.0',
      'mime-types': '^2.0.0',
    });
  });
});

test.concurrent('add --save-exact should not make all package.json strict', async () => {
  await runAdd(['left-pad@1.1.0'], {saveExact: true}, 'install-no-strict-all', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));

    expect(lockfile.indexOf('left-pad@1.1.0:')).toEqual(0);
    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'left-pad': '1.1.0',
      'mime-types': '^2.0.0',
    });
  });
});

test.concurrent('add save-prefix should not expand ~ to home dir', async () => {
  await runAdd(['left-pad'], {}, 'install-no-home-expand', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockfile[0]).toMatch(/^left-pad@~\d+\.\d+\.\d+:$/);
    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies['left-pad']).toMatch(
      /^~\d+\.\d+\.\d+$/,
    );
  });
});

test.concurrent('add save-exact should make all package.json strict', async () => {
  await runAdd(['left-pad'], {}, 'install-strict-all', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));

    expect(lockfile[0]).toMatch(/^left-pad@\d+\.\d+\.\d+:$/);
    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies['left-pad']).toMatch(
      /^\d+\.\d+\.\d+$/,
    );
  });
});

test.concurrent('add with new dependency should be deterministic 3', async () => {
  await runAdd([], {}, 'install-should-cleanup-when-package-json-changed-3', async (config, reporter) => {
    // expecting yarn check after installation not to fail

    await fs.copy(path.join(config.cwd, 'yarn.lock.after'), path.join(config.cwd, 'yarn.lock'), reporter);
    await fs.copy(path.join(config.cwd, 'package.json.after'), path.join(config.cwd, 'package.json'), reporter);

    const lockfile = await createLockfile(config.cwd);
    const install = new Install({}, config, reporter, lockfile);
    await install.init();

    let allCorrect = true;
    try {
      await check(config, reporter, {}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);
  });
});

test.concurrent('install --initMirror should add init mirror deps from package.json', async () => {
  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-init-mirror';

  // initMirror gets converted to save flag in cli/install.js
  await runAdd([], {}, fixture, async config => {
    expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');
    expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1')).toEqual(true);

    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    expect(mirror).toHaveLength(2);
    expect(mirror[0].relative.indexOf('mime-db-1.0.')).toEqual(0);
    expect(mirror[1].relative).toEqual('mime-types-2.0.0.tgz');

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines).toHaveLength(10);
    expect(lockFileLines[0].indexOf('mime-db@')).toEqual(0);
    expect(lockFileLines[4].indexOf('mime-types@2.0.0')).toEqual(0);
  });
});

test.concurrent('add with new dependency should be deterministic', async () => {
  // mime-types@2.0.0->mime-db@1.0.3 is saved in local mirror and is deduped
  // install mime-db@1.23.0 should move mime-db@1.0.3 deep into mime-types

  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-deterministic';

  await runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1')).toBe(true);
    expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');

    await runAdd(['mime-db@1.23.0'], {}, fixture, async config => {
      expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '1.23.0')).toEqual(true);

      expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');

      expect(await getPackageVersion(config, 'mime-types/mime-db')).toEqual('1.0.3');

      expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
        'mime-types': '2.0.0',
        'mime-db': '1.23.0',
      });

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);

      expect(lockFileLines).toHaveLength(12);
      expect(lockFileLines.indexOf('mime-db@~1.0.1:')).toBeGreaterThanOrEqual(0);
      expect(lockFileLines.indexOf('mime-db@1.23.0:')).toBeGreaterThanOrEqual(0);
      expect(lockFileLines.indexOf('mime-types@2.0.0:')).toBeGreaterThanOrEqual(0);

      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      expect(mirror).toHaveLength(3);
      expect(mirror[1].relative).toEqual('mime-db-1.23.0.tgz');
    });
  });
});

test.concurrent('add with new dependency should be deterministic 2', async () => {
  // mime-types@2.0.0->mime-db@1.0.1 is saved in local mirror and is deduped
  // install mime-db@1.0.3 should replace mime-db@1.0.1 in root

  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-deterministic-2';

  await runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    expect(await getPackageVersion(config, 'mime-db')).toEqual('1.0.1');

    expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');

    await runAdd(['mime-db@1.0.3'], {}, fixture, async config => {
      expect(await getPackageVersion(config, 'mime-db')).toEqual('1.0.3');

      expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');

      expect(await fs.exists(path.join(config.cwd, 'node_modules/mime-types/node-modules/mime-db'))).toEqual(false);

      expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
        'mime-types': '2.0.0',
        'mime-db': '1.0.3',
      });

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);
      // see why we don't cleanup lockfile https://github.com/yarnpkg/yarn/issues/79
      expect(lockFileLines).toHaveLength(12);

      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      expect(mirror).toHaveLength(3);
      expect(mirror[1].relative).toEqual('mime-db-1.0.3.tgz');
    });
  });
});

test.concurrent('add with offline mirror', async () => {
  const mirrorPath = 'mirror-for-offline';
  await runAdd(['is-array@^1.0.1'], {}, 'install-with-save-offline-mirror', async config => {
    const allFiles = await fs.walk(config.cwd);

    expect(
      allFiles.findIndex((file): boolean => {
        return file.relative === path.join(mirrorPath, 'is-array-1.0.1.tgz');
      }),
    ).toBeGreaterThanOrEqual(0);

    const rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    const {object: lockfile} = parse(rawLockfile);

    expect(lockfile['is-array@^1.0.1']['resolved']).toEqual(
      'https://registry.yarnpkg.com/is-array/-/is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a',
    );
  });
});

// broken https://github.com/yarnpkg/yarn/issues/2333
test.skip('add-then-install git+ssh from offline mirror', async () => {
  const mirrorPath = 'mirror-for-offline';

  await runAdd(
    ['mime-db@git+ssh://git@github.com/jshttp/mime-db.git#1.24.0'],
    {},
    'install-git-ssh-mirror',
    async (config, reporter): Promise<void> => {
      expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '1.24.0')).toEqual(true);

      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      expect(mirror).toHaveLength(1);

      expect(mirror[0].relative).toMatch(/mime-db\.git.*/);

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);
      // lock file contains mirror resolved line
      expect(
        lockFileLines.findIndex(line => {
          return line.match(/.*resolved mime-db\.git\-.*/);
        }),
      ).toBeGreaterThanOrEqual(0);

      // reinstall
      await fs.unlink(path.join(config.cwd, 'node_modules'));
      await fs.unlink(path.join(config.cwd, 'yarn.lock'));

      const install = new Install({}, config, reporter, new Lockfile());
      await install.init();

      expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '1.24.0')).toEqual(true);

      const newLockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const newLockFileLines = explodeLockfile(newLockFileWritten);
      // lock file contains mirror resolved line

      expect(newLockFileLines[2]).toEqual(lockFileLines[2]);
    },
  );
});

test.concurrent('install with --save and without offline mirror', async () => {
  const mirrorPath = 'mirror-for-offline';
  await runAdd(['is-array@^1.0.1'], {}, 'install-with-save-no-offline-mirror', async config => {
    const allFiles = await fs.walk(config.cwd);

    expect(
      allFiles.findIndex((file): boolean => {
        return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
      }),
    ).toEqual(-1);

    const rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    const {object: lockfile} = parse(rawLockfile);

    expect(lockfile['is-array@^1.0.1']['resolved']).toMatch(
      /https:\/\/registry\.yarnpkg\.com\/is-array\/-\/is-array-1\.0\.1\.tgz#[a-f0-9]+/,
    );
  });
});

test.concurrent('upgrade scenario', async () => {
  // left-pad first installed 0.0.9 then updated to 1.1.0
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  const mirrorPath = 'mirror-for-offline';

  await runAdd(['left-pad@0.0.9'], {}, 'install-upgrade-scenario', async (config, reporter): Promise<void> => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('0.0.9');

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'left-pad': '0.0.9',
    });

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);
    expect(lockFileLines).toHaveLength(4);
    expect(lockFileLines[0]).toEqual('left-pad@0.0.9:');
    expect(lockFileLines[2]).toMatch(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-0\.0\.9\.tgz#[a-f0-9]+"/,
    );

    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    expect(mirror).toHaveLength(1);
    expect(mirror[0].relative).toEqual('left-pad-0.0.9.tgz');

    //
    const add = new Add(['left-pad@1.1.0'], {}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await add.init();

    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.0');

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'left-pad': '1.1.0',
    });

    const lockFileWritten2 = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines2 = explodeLockfile(lockFileWritten2);
    expect(lockFileLines2).toHaveLength(4);
    expect(lockFileLines2[0]).toEqual('left-pad@1.1.0:');
    expect(lockFileLines2[2]).toMatch(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-1.1.0.tgz#[a-f0-9]+"/,
    );

    const mirror2 = await fs.walk(path.join(config.cwd, mirrorPath));
    expect(mirror2).toHaveLength(2);
    expect(mirror2[1].relative).toBe('left-pad-1.1.0.tgz');
  });
});

test.concurrent('upgrade scenario 2 (with sub dependencies)', async () => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-upgrade-scenario-2';

  await runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1')).toEqual(true);

    expect(await getPackageVersion(config, 'mime-types')).toEqual('2.0.0');

    await runAdd(['mime-types@2.1.11'], {}, fixture, async config => {
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

      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      expect(mirror).toHaveLength(4);

      const newFilesInMirror = mirror.filter((elem): boolean => {
        return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
      });

      expect(newFilesInMirror).toHaveLength(2);
    });
  });
});

test.concurrent('install another fork of an existing package', (): Promise<void> => {
  // When installing a package with the same name as an existing one but from a different repo,
  // the old one should be replaced with the new one in the lock file.
  const firstSource = 'davidreis97/example-yarn-package#master';
  const secondSource = 'yarnpkg/example-yarn-package#master';
  const pkgName = 'example-yarn-package';
  return runAdd([firstSource], {}, 'install-forked-git', async (config, reporter): Promise<void> => {
    let lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockfile.indexOf(`${pkgName}@${firstSource}:`)).toEqual(0);
    expect(lockfile.indexOf(`${pkgName}@${secondSource}:`)).toEqual(-1);

    const add = new Add([secondSource], {}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await add.init();

    lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));

    expect(lockfile.indexOf(`${pkgName}@${firstSource}:`)).toEqual(-1);
    expect(lockfile.indexOf(`${pkgName}@${secondSource}:`)).toEqual(0);
  });
});

test.concurrent('downgrade scenario', async () => {
  // left-pad first installed 1.1.0 then downgraded to 0.0.9
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  await runAdd(['left-pad@1.1.0'], {}, 'install-downgrade-scenario', async (config, reporter): Promise<void> => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.0');

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'left-pad': '1.1.0',
    });

    const mirrorPath = 'mirror-for-offline';
    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);
    expect(lockFileLines).toHaveLength(4);
    expect(lockFileLines[0]).toEqual('left-pad@1.1.0:');
    expect(lockFileLines[2]).toMatch(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-1\.1\.0\.tgz#[a-f0-9]+"/,
    );

    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    expect(mirror).toHaveLength(1);
    expect(mirror[0].relative).toEqual('left-pad-1.1.0.tgz');

    const add = new Add(['left-pad@0.0.9'], {}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await add.init();

    expect(await getPackageVersion(config, 'left-pad')).toEqual('0.0.9');

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'left-pad': '0.0.9',
    });

    const lockFileWritten2 = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines2 = explodeLockfile(lockFileWritten2);
    expect(lockFileLines2).toHaveLength(4);
    expect(lockFileLines2[0]).toEqual('left-pad@0.0.9:');
    expect(lockFileLines2[2]).toMatch(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-0\.0\.9\.tgz#[a-f0-9]+"/,
    );

    const mirror2 = await fs.walk(path.join(config.cwd, mirrorPath));
    expect(mirror2).toHaveLength(2);
    expect(mirror2[0].relative).toEqual('left-pad-0.0.9.tgz');
  });
});

// https://github.com/yarnpkg/yarn/issues/318
test.concurrent('modules resolved multiple times should save to mirror correctly', async () => {
  // the package.json in this fixture has 4 transitive dependants on module which that should resolve to
  // which@^1.0.5, which@^1.1.1, which@^1.2.8, which@^1.2.9:
  //   version "1.2.11"
  //   resolved which-1.2.11.tgz#c8b2eeea6b8c1659fa7c1dd4fdaabe9533dc5e8b
  await runAdd([], {}, 'no-mirror-remote-when-duplicates', async (config): Promise<void> => {
    const mirrorPath = 'mirror-for-offline';

    // check that which module was downloaded to mirror
    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    const whichModule = mirror.find((elem): any => elem.relative.match(/which-1\.2\..*\.tgz/));
    expect(whichModule).toBeDefined();

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);

    // which dependency must be resolved to file in local mirror
    const whichResolved = lockFileLines.find((elem): any =>
      elem.match(/resolved "https:\/\/registry\.yarnpkg\.com\/which\/-\/which-1\.2\..*\.tgz#[^"]+"/),
    );

    expect(whichResolved).toBeDefined();
  });
});

// For some packages the NPM registry is incorrectly returning HTTP tarball URLs, eg:
// http://registry.npmjs.org/onetime/-/onetime-1.1.0.tgz
test.concurrent('Insecure HTTP npmjs tarball URLs should still be normalised to registry.yarnpkg.com', async () => {
  await runAdd(['onetime@1.1.0'], {}, 'add-with-no-manifest', async config => {
    const lockFileLines = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockFileLines[2]).toContain('resolved "https://registry.yarnpkg.com/onetime/-/onetime-1.1.0.tgz');
  });
});

test.concurrent('add should put a git dependency to mirror', async () => {
  const mirrorPath = 'mirror-for-offline';

  await runAdd(
    ['mime-db@https://github.com/jshttp/mime-db.git#1.24.0'],
    {},
    'install-git-mirror',
    async (config, reporter): Promise<void> => {
      expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '1.24.0')).toEqual(true);

      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      expect(mirror).toHaveLength(1);
      expect(mirror[0].relative).toMatch(/mime-db\.git.*/);

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);
      // lock file contains mirror resolved line
      expect(
        lockFileLines.find(line => line.match(/resolved "https:\/\/github.com\/jshttp\/mime-db\.git#[^"]+"/)),
      ).toBeDefined();

      // can reinstall, now from mirror
      await fs.unlink(path.join(config.cwd, 'node_modules'));

      //
      const install = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await install.init();

      expect(semver.satisfies(await getPackageVersion(config, 'mime-db'), '1.24.0')).toEqual(true);

      await fs.unlink(path.join(config.cwd, mirrorPath));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    },
  );
});

test.concurrent('add should store latest version in lockfile', async () => {
  await runAdd(['max-safe-integer'], {}, 'latest-version-in-lockfile', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    const version = pkg.dependencies['max-safe-integer'];
    expect(semver.valid(version.slice(1))).toBeTruthy();
    expect(lockfile.indexOf('max-safe-integer:')).toEqual(-1);
    expect(lockfile.indexOf(`max-safe-integer@${version}:`)).toEqual(0);
  });
});

test.concurrent('add should generate correct integrity file', async () => {
  await runAdd(['mime-db@1.24.0'], {}, 'integrity-check', async (config, reporter) => {
    let allCorrect = true;
    try {
      await check(config, reporter, {integrity: true}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);

    // add to an existing package.json caused incorrect integrity https://github.com/yarnpkg/yarn/issues/1733
    const add = new Add(['left-pad@1.1.3'], {}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await add.init();
    try {
      await check(config, reporter, {integrity: true}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);
  });
});

test.concurrent('add infers line endings from existing win32 manifest file', async () => {
  await runAdd(
    ['is-online'],
    {},
    'add-infers-line-endings-from-existing-manifest-file',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'package.json'), 'utf8');
      expect(lockfile).toMatch(/\r\n/);
      expect(lockfile).not.toMatch(/[^\r]\n/);
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '{ "dependencies": {} }\r\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'package.json'), existingLockfile, 'utf8');
    },
  );
});

test.concurrent('add infers line endings from existing unix manifest file', async () => {
  await runAdd(
    ['is-online'],
    {},
    'add-infers-line-endings-from-existing-manifest-file',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'package.json'), 'utf8');
      expect(lockfile).toMatch(/[^\r]\n/);
      expect(lockfile).not.toMatch(/\r\n/);
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '{ "dependencies": {} }\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'package.json'), existingLockfile, 'utf8');
    },
  );
});

// broken https://github.com/yarnpkg/yarn/issues/2466
test.skip('add asks for correct package version if user passes an incorrect one', async () => {
  let chosenVersion = null;
  await runAdd(
    ['is-array@100'],
    {},
    'add-asks-correct-package-version',
    async config => {
      expect(chosenVersion).toBeTruthy();
      expect(await getPackageVersion(config, 'is-array')).toEqual(chosenVersion);
    },
    () => {
      // $FlowFixMe It seems we're assigning something totally different from what inquirer expects :/
      inquirer.prompt = jest.fn(questions => {
        expect(questions).toHaveLength(1);
        expect(questions[0].name).toEqual('package');

        const choices = questions[0].choices;
        invariant(Array.isArray(choices));
        expect(choices.length).toBeGreaterThan(0);
        invariant(choices.length > 0);
        chosenVersion = choices[0];
        invariant(typeof chosenVersion === 'string');
        return Promise.resolve({package: chosenVersion});
      });
    },
  );
});

test.concurrent('install with latest tag', async () => {
  await runAdd(['left-pad@latest'], {}, 'latest-version-in-package', async config => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, 'left-pad');

    expect(pkg.dependencies).toEqual({'left-pad': `^${version}`});
    expect(lockfile.indexOf(`left-pad@^${version}:`)).toEqual(0);
  });
});

test.concurrent('install with latest tag and --offline flag', async () => {
  await runAdd(['left-pad@latest'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    config.offline = true;
    const add = new Add(['left-pad@latest'], {}, config, reporter, previousAdd.lockfile);
    await add.init();

    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, 'left-pad');

    expect(pkg.dependencies).toEqual({'left-pad': `^${version}`});
  });
});

test.concurrent('install with latest tag and --offline flag scoped', async () => {
  await runAdd(['@types/node@8.0.0'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    config.offline = true;
    const add = new Add(['@types/node@latest'], {}, config, reporter, previousAdd.lockfile);
    await add.init();

    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, '@types/node');

    expect(pkg.dependencies).toEqual({'@types/node': `^${version}`});
  });
});

test.concurrent('install with latest tag and --prefer-offline flag', async () => {
  await runAdd(['left-pad@1.1.0'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    config.preferOffline = true;
    const add = new Add(['left-pad@latest'], {}, config, reporter, previousAdd.lockfile);
    await add.init();

    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, 'left-pad');

    expect(pkg.dependencies).toEqual({'left-pad': `^${version}`});
    expect(version).not.toEqual('1.1.0');
  });
});

test.concurrent('install with latest tag and --prefer-offline flag scoped', async () => {
  await runAdd(['@types/node@8.0.0'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    config.preferOffline = true;
    const add = new Add(['@types/node@latest'], {}, config, reporter, previousAdd.lockfile);
    await add.init();

    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, '@types/node');

    expect(pkg.dependencies).toEqual({'@types/node': `^${version}`});
    expect(version).not.toEqual('1.1.0');
  });
});

test.concurrent("doesn't warn when peer dependency is met during add", async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('unmet peer') > -1;
        }),
      ).toEqual(false);

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('incorrect peer') > -1;
        }),
      ).toEqual(false);
    },
    ['react@15.4.2', 'react-dom@15.4.2'],
    {},
    'add-with-peer-dependency-met',
  );
});

test.concurrent('warns when peer dependency is not met during add', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('unmet peer') > -1;
        }),
      ).toEqual(true);
    },
    ['react-dom@15.4.2'],
    {},
    'add-with-peer-dependency-not-met',
  );
});

test.concurrent('warns when peer dependency is incorrect during add', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('incorrect peer') > -1;
        }),
      ).toEqual(true);
    },
    ['react@0.14.8', 'react-dom@15.4.2'],
    {},
    'add-with-peer-dependency-incorrect',
  );
});

test.concurrent('should only refer to higher levels to satisfy peer dependency', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning').map(entry => entry.data);
      expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('incorrect peer')]));
    },
    ['file:c'],
    {},
    'add-with-multiple-versions-of-peer-dependency',
  );
});

test.concurrent('should refer to deeper dependencies to satisfy peer dependency', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning').map(entry => entry.data);
      expect(warnings).not.toEqual(expect.arrayContaining([expect.stringContaining('peer')]));
    },
    [],
    {},
    'add-with-deep-peer-dependencies',
  );
});

test.concurrent('should retain build artifacts after add when missing integrity file', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      const lockfile = await createLockfile(config.cwd);

      const addA = new Add(args, flags, config, reporter, lockfile);
      await addA.init();

      const expectedArtifacts = ['foo.txt'];
      const integrityLoc = path.join(config.cwd, 'node_modules', constants.INTEGRITY_FILENAME);

      const beforeIntegrity = await fs.readJson(integrityLoc);
      expect(beforeIntegrity.artifacts['a@0.0.0']).toEqual(expectedArtifacts);

      await fs.unlink(integrityLoc);

      const lockfileAfterPreviousAdd = await Lockfile.fromDirectory(config.cwd);
      const addB = new Add(['file:b'], flags, config, reporter, lockfileAfterPreviousAdd);
      await addB.init();

      const afterIntegrity = await fs.readJson(integrityLoc);
      expect(afterIntegrity.artifacts['a@0.0.0']).toEqual(expectedArtifacts);
    },
    ['file:a'],
    {},
    'retain-build-artifacts-missing-integrity',
  );
});

test.concurrent('should retain build artifacts after add', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const addA = new Add(args, flags, config, reporter, lockfile);
      await addA.init();

      const expectedArtifacts = ['foo.txt'];
      const integrityLoc = path.join(config.cwd, 'node_modules', constants.INTEGRITY_FILENAME);

      const beforeIntegrity = await fs.readJson(integrityLoc);
      expect(beforeIntegrity.artifacts['a@0.0.0']).toEqual(expectedArtifacts);

      const addB = new Add(['file:b'], flags, config, reporter, lockfile);
      await addB.init();

      const afterIntegrity = await fs.readJson(integrityLoc);
      expect(afterIntegrity.artifacts['a@0.0.0']).toEqual(expectedArtifacts);
    },
    ['file:a'],
    {},
    'retain-build-artifacts-after-add',
  );
});

// If an install script changed a file that was installed with the package,
// then all subsequent yarn commands (like add) would see the file as changed, marking
// the package as "fresh" and re-running install scripts.
// The fix was to not mark a package as "fresh" if a changed file was also a build artifact.
// This test writes the current timestamp to a file tht also existed in the package.
// The timestamp generated by package A shouldn't change when adding package B.
// See: https://github.com/yarnpkg/yarn/issues/932#issuecomment-370245462
test('should not run scripts if build artifact changed', async () => {
  await buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const addA = new Add(args, flags, config, reporter, lockfile);
      await addA.init();

      const artifactFile = path.join(config.cwd, 'node_modules', 'a', 'foo.txt');

      const beforeContents = await fs.readFileAny([artifactFile]);

      // re-read lockfile after the first `add` or else it will still be empty
      lockfile = await Lockfile.fromDirectory(config.cwd);

      const addB = new Add(['file:b'], flags, config, reporter, lockfile);
      await addB.init();

      const afterContents = await fs.readFileAny([artifactFile]);
      expect(afterContents).toEqual(beforeContents);
    },
    ['file:a'],
    {},
    'retain-build-artifacts-after-add',
  );
});

test.concurrent('installing with --pure-lockfile and then adding should keep build artifacts', async () => {
  const fixture = 'integrity-pure-lockfile';

  await runInstall({pureLockfile: true}, path.join('..', 'add', fixture), async (config, reporter): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', '.yarn-integrity'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'package-a', 'temp.txt'))).toBe(true);
    const add = new Add(['left-pad@1.1.0'], {}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await add.init();
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'package-a', 'temp.txt'))).toBe(true);
  });
});

test.concurrent('preserves unaffected bin links after adding to workspace package', async () => {
  await runInstall({binLinks: true}, 'workspaces-install-bin', async (config, reporter): Promise<void> => {
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/touch`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/workspace-1`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/workspace-1`)).toEqual(true);

    // add package
    const childConfig = await makeConfigFromDirectory(`${config.cwd}/packages/workspace-1`, reporter, {binLinks: true});
    await add(childConfig, reporter, {}, ['max-safe-integer@1.0.0']);

    expect(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'packages/workspace-1/package.json'))).dependencies,
    ).toEqual({
      'max-safe-integer': '1.0.0',
    });

    // bin links should be preserved
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/touch`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/workspace-1`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/workspace-1`)).toEqual(true);
  });
});

test.concurrent('installs "latest" instead of maxSatisfying if it satisfies requested pattern', async () => {
  // Scenario:
  // If a registry contains versions [1.0.0, 1.0.1, 1.0.2] and latest:1.0.1
  // (note that "latest" is not the "newest" version)
  // If yarn add ^1.0.0 is run, it should choose `1.0.1` because it is "latest" and satisfies the range,
  // not `1.0.2` even though it is newer.
  // This is behavior defined by the NPM implementation. See:
  //  * https://github.com/yarnpkg/yarn/issues/3560
  //  * https://git.io/vFmau
  //
  // In this test, `ui-select` has a max version of `0.20.0` but a `latest:0.19.8`
  await runAdd(['ui-select@^0.X'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const patternIndex = lockfile.indexOf('ui-select@^0.X:');
    const versionIndex = patternIndex + 1;
    const actualVersion = lockfile[versionIndex];

    expect(actualVersion).toContain('0.19.8');
  });
});

test.concurrent('installs "latest" instead of maxSatisfying if no requested pattern', async () => {
  // Scenario:
  // If a registry contains versions [1.0.0, 1.0.1, 1.0.2] and latest:1.0.1
  // If `yarn add` is run, it should choose `1.0.1` because it is "latest", not `1.0.2` even though it is newer.
  // In other words, when no range is explicitly given, Yarn should choose "latest".
  //
  // In this test, `ui-select` has a max version of `0.20.0` but a `latest:0.19.8`
  await runAdd(['ui-select'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const patternIndex = lockfile.indexOf('ui-select@^0.19.8:');
    const versionIndex = patternIndex + 1;
    const actualVersion = lockfile[versionIndex];

    expect(actualVersion).toContain('0.19.8');
  });
});

describe('nohoist', () => {
  test.concurrent('can add nohoist package from workspace', async () => {
    await runInstall({}, 'workspaces-install-nohoist-across-versions', async (config, reporter): Promise<void> => {
      // workspace-2 has b and c since the root has nohoist = ['a', 'b', 'c']
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/b`)).toEqual(true);
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/c`)).toEqual(true);

      // prove package a does not exist in workspace-2 nor in root
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/a`)).toEqual(false);
      expect(await fs.exists(`${config.cwd}/node_modules/a`)).toEqual(false);
      expect(await fs.exists(`${config.cwd}/node_modules/b`)).toEqual(false);
      expect(await fs.exists(`${config.cwd}/node_modules/c`)).toEqual(false);

      // add package 'a' to workspace-2
      const childConfig = await makeConfigFromDirectory(`${config.cwd}/packages/workspace-2`, reporter, {});
      await add(childConfig, reporter, {}, ['file:a']);

      // now package a should exist in workspace-2
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/a`)).toEqual(true);
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/b`)).toEqual(true);
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/c`)).toEqual(true);

      // make sure workspace-2 dependencies didn't get hoisted to root
      expect(await fs.exists(`${config.cwd}/node_modules/a`)).toEqual(false);
      expect(await fs.exists(`${config.cwd}/node_modules/b`)).toEqual(false);
      expect(await fs.exists(`${config.cwd}/node_modules/c`)).toEqual(false);
    });
  });
  test.concurrent('can add nohoist package from root', async () => {
    await runInstall({}, 'workspaces-install-nohoist-across-versions', async (config, reporter): Promise<void> => {
      // prove package a does not exist in workspace-2 nor in root
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/a`)).toEqual(false);
      expect(await fs.exists(`${config.cwd}/node_modules/a`)).toEqual(false);

      // add package 'a' to root package
      await add(config, reporter, {ignoreWorkspaceRootCheck: true}, ['file:a']);

      // now package a should exist in workspace-2
      expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/a`)).toEqual(false);
      expect(await fs.exists(`${config.cwd}/node_modules/a`)).toEqual(true);
    });
  });
});
