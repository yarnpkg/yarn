/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import * as reporters from '../../src/reporters/index.js';
import {getPackageVersion, createLockfile, explodeLockfile, run as buildRun, runInstall} from './_helpers.js';
import {Add} from '../../src/cli/commands/add.js';
import * as constants from '../../src/constants.js';
import {parse} from '../../src/lockfile/wrapper.js';
import {Install} from '../../src/cli/commands/install.js';
import Lockfile from '../../src/lockfile/wrapper.js';
import {run as check} from '../../src/cli/commands/check.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';
import semver from 'semver';
import {promisify} from '../../src/util/promise';
import fsNode from 'fs';
import inquirer from 'inquirer';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');

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

test.concurrent('install with arg', (): Promise<void> => {
  return runAdd(['is-online'], {}, 'install-with-arg');
});

test.concurrent('install from github', (): Promise<void> => {
  return runAdd(['substack/node-mkdirp#master'], {}, 'install-github');
});

test.concurrent('install with --dev flag', (): Promise<void> => {
  return runAdd(['left-pad@1.1.0'], {dev: true}, 'add-with-flag', async (config) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('left-pad@1.1.0:') === 0);
    assert.deepEqual(pkg.devDependencies, {'left-pad': '1.1.0'});
    assert.deepEqual(pkg.dependencies, {});
  });
});

test.concurrent('install with --peer flag', (): Promise<void> => {
  return runAdd(['left-pad@1.1.0'], {peer: true}, 'add-with-flag', async (config) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('left-pad@1.1.0:') === 0);
    assert.deepEqual(pkg.peerDependencies, {'left-pad': '1.1.0'});
    assert.deepEqual(pkg.dependencies, {});
  });
});

test.concurrent('install with --optional flag', (): Promise<void> => {
  return runAdd(['left-pad@1.1.0'], {optional: true}, 'add-with-flag', async (config) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('left-pad@1.1.0:') === 0);
    assert.deepEqual(pkg.optionalDependencies, {'left-pad': '1.1.0'});
    assert.deepEqual(pkg.dependencies, {});
  });
});

test.concurrent('install with arg that has binaries', (): Promise<void> => {
  return runAdd(['react-native-cli'], {}, 'install-with-arg-and-bin');
});

test.concurrent('add with no manifest creates blank manifest', (): Promise<void> => {
  return runAdd(['lodash'], {}, 'add-with-no-manifest', async (config) => {
    assert.ok(await fs.exists(path.join(config.cwd, 'package.json')));
  });
});

test.concurrent('add should ignore cache', (): Promise<void> => {
  // left-pad@1.1.0 gets installed without --save
  // left-pad@1.1.0 gets installed with --save
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  return runAdd(['left-pad@1.1.0'], {}, 'install-save-to-mirror-when-cached', async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0',
    );

    const lockfile = await createLockfile(config.cwd);
    const install = new Add(['left-pad@1.1.0'], {}, config, reporter, lockfile);
    await install.init();
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '1.1.0'},
    );

    const mirror = await fs.walk(path.join(config.cwd, 'mirror-for-offline'));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-1.1.0.tgz');

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);

    assert.equal(lockFileLines.length, 3);

    assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
    assert.ok(lockFileLines[2].match(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-1\.1\.0\.tgz#[a-f0-9]+"/,
    ));
  });
});

test.concurrent('add should not make package.json strict', (): Promise<void> => {
  return runAdd(['left-pad@^1.1.0'], {}, 'install-no-strict', async (config) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));

    assert(lockfile.indexOf('left-pad@^1.1.0:') >= 0);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {
        'left-pad': '^1.1.0',
        'mime-types': '^2.0.0',
      },
    );
  });
});

test.concurrent('add --save-exact should not make all package.json strict', (): Promise<void> => {
  return runAdd(['left-pad@1.1.0'], {saveExact: true}, 'install-no-strict-all', async (config) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));

    assert(lockfile.indexOf('left-pad@1.1.0:') === 0);
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {
        'left-pad': '1.1.0',
        'mime-types': '^2.0.0',
      },
    );
  });
});

test.concurrent('add with new dependency should be deterministic 3', (): Promise<void> => {
  return runAdd([], {}, 'install-should-cleanup-when-package-json-changed-3', async (config, reporter) => {
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

test.concurrent('install --initMirror should add init mirror deps from package.json',
(): Promise<void> => {
  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-init-mirror';

  // initMirror gets converted to save flag in cli/install.js
  return runAdd([], {}, fixture, async (config) => {
    assert.equal(await getPackageVersion(config, 'mime-types'), '2.0.0');
    assert(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1'));

    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 2);
    assert.equal(mirror[0].relative.indexOf('mime-db-1.0.'), 0);
    assert.equal(mirror[1].relative, 'mime-types-2.0.0.tgz');

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 8);
    assert.equal(lockFileLines[0].indexOf('mime-db@'), 0);
    assert.equal(lockFileLines[3].indexOf('mime-types@2.0.0'), 0);
  });
});

test.concurrent('add with new dependency should be deterministic', (): Promise<void> => {
  // mime-types@2.0.0->mime-db@1.0.3 is saved in local mirror and is deduped
  // install mime-db@1.23.0 should move mime-db@1.0.3 deep into mime-types

  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-deterministic';

  return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1'),
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    return runAdd(['mime-db@1.23.0'], {}, fixture, async (config) => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '1.23.0',
      ));
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.0.0',
      );
      assert.equal(
        await getPackageVersion(config, 'mime-types/mime-db'),
        '1.0.3',
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies, {
          'mime-types': '2.0.0',
          'mime-db': '1.23.0',
        },
      );

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);
      assert.equal(lockFileLines.length, 11);
      assert(lockFileLines.indexOf('mime-db@~1.0.1:') >= 0);
      assert(lockFileLines.indexOf('mime-db@1.23.0:') >= 0);
      assert(lockFileLines.indexOf('mime-types@2.0.0:') >= 0);


      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, 'mime-db-1.23.0.tgz');
    });
  });
});

test.concurrent('add with new dependency should be deterministic 2', (): Promise<void> => {
  // mime-types@2.0.0->mime-db@1.0.1 is saved in local mirror and is deduped
  // install mime-db@1.0.3 should replace mime-db@1.0.1 in root

  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-deterministic-2';

  return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'mime-db'),
      '1.0.1',
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    return runAdd(['mime-db@1.0.3'], {}, fixture, async (config) => {
      assert.equal(
        await getPackageVersion(config, 'mime-db'),
        '1.0.3',
      );
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.0.0',
      );
      assert(!await fs.exists(path.join(config.cwd, 'node_modules/mime-types/node-modules/mime-db')));
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies, {
          'mime-types': '2.0.0',
          'mime-db': '1.0.3',
        },
      );

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);
      // see why we don't cleanup lockfile https://github.com/yarnpkg/yarn/issues/79
      assert.equal(lockFileLines.length, 11);

      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, 'mime-db-1.0.3.tgz');
    });
  });
});

test.concurrent('add with offline mirror', (): Promise<void> => {
  const mirrorPath = 'mirror-for-offline';
  return runAdd(['is-array@^1.0.1'], {}, 'install-with-save-offline-mirror', async (config) => {
    const allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === path.join(mirrorPath, 'is-array-1.0.1.tgz');
    }) !== -1);

    const rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    const lockfile = parse(rawLockfile);
    assert.equal(
      lockfile['is-array@^1.0.1']['resolved'],
      'https://registry.yarnpkg.com/is-array/-/is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a',
    );
  });
});

// broken https://github.com/yarnpkg/yarn/issues/2333
test.skip('add-then-install git+ssh from offline mirror', () : Promise<void> => {
  const mirrorPath = 'mirror-for-offline';

  return runAdd(['mime-db@git+ssh://git@github.com/jshttp/mime-db.git#1.24.0'], {},
  'install-git-ssh-mirror', async (config, reporter) : Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '1.24.0'),
    );

    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);

    assert(mirror[0].relative.match(/mime-db\.git.*/));

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);
    // lock file contains mirror resolved line
    expect(lockFileLines.find((line) => line.match(/.*resolved mime-db\.git\-.*/))).toBeDefined();

    // reinstall
    await fs.unlink(path.join(config.cwd, 'node_modules'));
    await fs.unlink(path.join(config.cwd, 'yarn.lock'));

    const install = new Install({}, config, reporter, new Lockfile());
    await install.init();

    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '1.24.0'),
    );

    const newLockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const newLockFileLines = explodeLockfile(newLockFileWritten);
    // lock file contains mirror resolved line

    expect(newLockFileLines[2]).toEqual(lockFileLines[2]);
  });
});

test.concurrent('install with --save and without offline mirror', (): Promise<void> => {
  const mirrorPath = 'mirror-for-offline';
  return runAdd(['is-array@^1.0.1'], {}, 'install-with-save-no-offline-mirror', async (config) => {

    const allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) === -1);

    const rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    const lockfile = parse(rawLockfile);

    assert(lockfile['is-array@^1.0.1']['resolved'].match(
      /https:\/\/registry\.yarnpkg\.com\/is-array\/-\/is-array-1\.0\.1\.tgz#[a-f0-9]+/,
    ));
  });
});

test.concurrent('upgrade scenario', (): Promise<void> => {
  // left-pad first installed 0.0.9 then updated to 1.1.0
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  const mirrorPath = 'mirror-for-offline';

  return runAdd(['left-pad@0.0.9'], {}, 'install-upgrade-scenario', async (config, reporter): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '0.0.9',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '0.0.9'},
    );

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);
    assert.equal(lockFileLines[0], 'left-pad@0.0.9:');
    assert.equal(lockFileLines.length, 3);
    assert.ok(lockFileLines[2].match(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-0\.0\.9\.tgz#[a-f0-9]+"/,
    ));

    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-0.0.9.tgz');

    //
    const add = new Add(['left-pad@1.1.0'], {}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await add.init();

    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '1.1.0'},
    );

    const lockFileWritten2 = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines2 = explodeLockfile(lockFileWritten2);
    assert.equal(lockFileLines2[0], 'left-pad@1.1.0:');
    assert.equal(lockFileLines2.length, 3);
    assert.ok(lockFileLines2[2].match(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-1.1.0.tgz#[a-f0-9]+"/,
    ));

    const mirror2 = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror2.length, 2);
    assert.equal(mirror2[1].relative, 'left-pad-1.1.0.tgz');
  });
});

test.concurrent('upgrade scenario 2 (with sub dependencies)', (): Promise<void> => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  const mirrorPath = 'mirror-for-offline';
  const fixture = 'install-upgrade-scenario-2';

  return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1'),
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    return runAdd(['mime-types@2.1.11'], {}, fixture, async (config) => {
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
      assert.ok(lockFileLines[2].match(
        /resolved "https:\/\/registry\.yarnpkg\.com\/mime-db\/-\/mime-db-/,
      ));
      assert.equal(lockFileLines[3], 'mime-types@2.1.11:');
      assert.ok(lockFileLines[5].match(
        /resolved "https:\/\/registry\.yarnpkg\.com\/mime-types\/-\/mime-types-2\.1\.11\.tgz#[a-f0-9]+"/,
      ));

      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 4);
      const newFilesInMirror = mirror.filter((elem): boolean => {
        return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
      });

      assert.equal(newFilesInMirror.length, 2);
    });
  });
});

test.concurrent('downgrade scenario', (): Promise<void> => {
  // left-pad first installed 1.1.0 then downgraded to 0.0.9
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  return runAdd(['left-pad@1.1.0'], {}, 'install-downgrade-scenario', async (config, reporter): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '1.1.0'},
    );

    const mirrorPath = 'mirror-for-offline';
    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);

    assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
    assert.equal(lockFileLines.length, 3);
    assert.ok(lockFileLines[2].match(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-1\.1\.0\.tgz#[a-f0-9]+"/,
    ));

    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-1.1.0.tgz');

    //

    const add = new Add(['left-pad@0.0.9'], {},  config, reporter, await Lockfile.fromDirectory(config.cwd));
    await add.init();

    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '0.0.9',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '0.0.9'},
    );

    const lockFileWritten2 = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines2 = explodeLockfile(lockFileWritten2);

    assert.equal(lockFileLines2[0], 'left-pad@0.0.9:');
    assert.equal(lockFileLines2.length, 3);
    assert.ok(lockFileLines2[2].match(
      /resolved "https:\/\/registry\.yarnpkg\.com\/left-pad\/-\/left-pad-0\.0\.9\.tgz#[a-f0-9]+"/,
    ));

    const mirror2 = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror2.length, 2);
    assert.equal(mirror2[0].relative, 'left-pad-0.0.9.tgz');
  });
});

// https://github.com/yarnpkg/yarn/issues/318
test.concurrent('modules resolved multiple times should save to mirror correctly', (): Promise<void> => {
  // the package.json in this fixture has 4 transitive dependants on module which that should resolve to
  // which@^1.0.5, which@^1.1.1, which@^1.2.8, which@^1.2.9:
  //   version "1.2.11"
  //   resolved which-1.2.11.tgz#c8b2eeea6b8c1659fa7c1dd4fdaabe9533dc5e8b
  return runAdd([], {}, 'no-mirror-remote-when-duplicates', async (config): Promise<void> => {
    const mirrorPath = 'mirror-for-offline';

    // check that which module was downloaded to mirror
    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    const whichModule = mirror.find((elem): any => elem.relative.match(/which-1\.2\.12\.tgz/));
    expect(whichModule).toBeDefined();

    const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileWritten);

    // which dependency must be resolved to file in local mirror
    const whichResolved = lockFileLines.find((elem): any => elem.match(
      /resolved "https:\/\/registry\.yarnpkg\.com\/which\/-\/which-1\.2\.12\.tgz#[^"]+"/,
    ));

    expect(whichResolved).toBeDefined();
  });
});

test.concurrent('add should put a git dependency to mirror', (): Promise<void> => {
  const mirrorPath = 'mirror-for-offline';

  return runAdd(
    ['mime-db@https://github.com/jshttp/mime-db.git#1.24.0'],
    {},
    'install-git-mirror',
    async (config, reporter): Promise<void> => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '1.24.0'),
      );
      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 1);
      expect(mirror[0].relative).toMatch(/mime-db\.git.*/);

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);
      // lock file contains mirror resolved line
      expect(lockFileLines.find((line) => line.match(
        /resolved "https:\/\/github.com\/jshttp\/mime-db\.git#[^"]+"/,
      ))).toBeDefined();

      // can reinstall, now from mirror
      await fs.unlink(path.join(config.cwd, 'node_modules'));

      //
      const install = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
      await install.init();

      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '1.24.0'),
      );
      await fs.unlink(path.join(config.cwd, mirrorPath));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    },
  );
});

test.concurrent('add should store latest version in lockfile', (): Promise<void> => {
  return runAdd(['max-safe-integer'], {}, 'latest-version-in-lockfile', async (config) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    const version = pkg.dependencies['max-safe-integer'];
    assert(semver.valid(version.slice(1)));
    assert(lockfile.indexOf('max-safe-integer:') === -1);
    assert(lockfile.indexOf(`max-safe-integer@${version}:`) === 0);
  });
});

test.concurrent('add should generate correct integrity file', (): Promise<void> => {
  return runAdd(['mime-db@1.24.0'], {}, 'integrity-check', async (config, reporter) => {
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

test.concurrent('add infers line endings from existing win32 manifest file', async (): Promise<void> => {
  await runAdd(['is-online'], {}, 'add-infers-line-endings-from-existing-manifest-file',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'package.json'), 'utf8');
      assert(/\r\n/.test(lockfile));
      assert(!/[^\r]\n/.test(lockfile));
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '{ "dependencies": {} }\r\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'package.json'), existingLockfile, 'utf8');
    });
});

test.concurrent('add infers line endings from existing unix manifest file', async (): Promise<void> => {
  await runAdd(['is-online'], {}, 'add-infers-line-endings-from-existing-manifest-file',
    async (config): Promise<void> => {
      const lockfile = await promisify(fsNode.readFile)(path.join(config.cwd, 'package.json'), 'utf8');
      assert(/[^\r]\n/.test(lockfile));
      assert(!/\r\n/.test(lockfile));
    },
    async (cwd): Promise<void> => {
      const existingLockfile = '{ "dependencies": {} }\n';
      await promisify(fsNode.writeFile)(path.join(cwd, 'package.json'), existingLockfile, 'utf8');
    });
});

// broken https://github.com/yarnpkg/yarn/issues/2466
test.skip('add asks for correct package version if user passes an incorrect one', async (): Promise<void> => {
  let chosenVersion = null;
  await runAdd(
    ['is-array@100'],
    {},
    'add-asks-correct-package-version',
    async (config) => {
      assert(chosenVersion);
      assert.equal(await getPackageVersion(config, 'is-array'), chosenVersion);
    },
    () => {
      inquirer.prompt = jest.fn((questions) => {
        assert(questions.length === 1);
        assert(questions[0].name === 'package');
        assert(questions[0].choices.length > 0);
        chosenVersion = questions[0].choices[0];
        return Promise.resolve({package: chosenVersion});
      });
    },
  );
});

test.concurrent('install with latest tag', (): Promise<void> => {
  return runAdd(['left-pad@latest'], {}, 'latest-version-in-package', async (config) => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, 'left-pad');

    assert.deepEqual(pkg.dependencies, {'left-pad': `^${version}`});
    assert(lockfile.indexOf(`left-pad@^${version}:`) === 0);
  });
});

test.concurrent('install with latest tag and --offline flag', (): Promise<void> => {
  return runAdd(['left-pad@latest'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    config.offline = true;
    const add = new Add(['left-pad@latest'], {}, config, reporter, previousAdd.lockfile);
    await add.init();

    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, 'left-pad');

    assert.deepEqual(pkg.dependencies, {'left-pad': `^${version}`});
  });
});

test.concurrent('install with latest tag and --prefer-offline flag', (): Promise<void> => {
  return runAdd(['left-pad@1.1.0'], {}, 'latest-version-in-package', async (config, reporter, previousAdd) => {
    config.preferOffline = true;
    const add = new Add(['left-pad@latest'], {}, config, reporter, previousAdd.lockfile);
    await add.init();

    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const version = await getPackageVersion(config, 'left-pad');

    assert.deepEqual(pkg.dependencies, {'left-pad': `^${version}`});
    assert.notEqual(version, '1.1.0');
  });
});

test.concurrent('doesn\'t warn when peer dependency is met during add', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();
      const output = reporter.getBuffer();
      const warnings = output.filter((entry) => entry.type === 'warning');
      assert(!warnings.some((warning) => warning.data.toString().toLowerCase().includes('unmet peer')));
      assert(!warnings.some((warning) => warning.data.toString().toLowerCase().includes('incorrect peer')));
    },
    ['react@15.4.2', 'react-dom@15.4.2'],
    {},
    'add-with-peer-dependency-met',
  );
});

test.concurrent('warns when peer dependency is not met during add', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();
      const output = reporter.getBuffer();
      const warnings = output.filter((entry) => entry.type === 'warning');
      assert(warnings.some((warning) => warning.data.toString().toLowerCase().includes('unmet peer')));
    },
    ['react-dom@15.4.2'],
    {},
    'add-with-peer-dependency-not-met',
  );
});

test.concurrent('warns when peer dependency is incorrect during add', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const add = new Add(args, flags, config, reporter, lockfile);
      await add.init();
      const output = reporter.getBuffer();
      const warnings = output.filter((entry) => entry.type === 'warning');
      assert(warnings.some((warning) => warning.data.toString().toLowerCase().includes('incorrect peer')));
    },
    ['react@0.14.8', 'react-dom@15.4.2'],
    {},
    'add-with-peer-dependency-incorrect',
  );
});
