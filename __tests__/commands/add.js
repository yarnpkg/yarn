/* @flow */

import {getPackageVersion, createLockfile, explodeLockfile, run as buildRun} from './_install.js';
import {Add} from '../../src/cli/commands/add.js';
import {Reporter} from '../../src/reporters/index.js';
import * as constants from '../../src/constants.js';
import {parse} from '../../src/lockfile/wrapper.js';
import {Install} from '../../src/cli/commands/install.js';
import {run as check} from '../../src/cli/commands/check.js';
import Config from '../../src/config.js';
import * as fs from '../../src/util/fs.js';
import {runInstall} from './_install.js';
import assert from 'assert';
import semver from 'semver';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

let path = require('path');

let fixturesLoc = path.join(__dirname, '..', 'fixtures', 'add');

function runAdd(
  flags: Object,
  args: Array<string>,
  name: string,
  checkInstalled?: ?(config: Config, reporter: Reporter) => ?Promise<void>,
  beforeInstall?: ?(cwd: string) => ?Promise<void>,
): Promise<void> {
  return buildRun((config, reporter, lockfile): Install => {
    return new Add(args, flags, config, reporter, lockfile);
  }, path.join(fixturesLoc, name), checkInstalled, beforeInstall);
}

test.concurrent('install with arg that has install scripts', (): Promise<void> => {
  return runAdd({}, ['flow-bin'], 'install-with-arg-and-install-scripts');
});

test.concurrent('install with arg', (): Promise<void> => {
  return runAdd({}, ['is-online'], 'install-with-arg');
});

test.concurrent('install with arg that has binaries', (): Promise<void> => {
  return runAdd({}, ['react-native-cli'], 'install-with-arg-and-bin');
});

test.concurrent('add should ignore cache', (): Promise<void> => {
  // left-pad@1.1.0 gets installed without --save
  // left-pad@1.1.0 gets installed with --save
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-save-to-mirror-when-cached';

  return runAdd({}, ['left-pad@1.1.0'], fixture, async (config, reporter) => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0',
    );

    let lockfile = await createLockfile(config.cwd);
    let install = new Add(['left-pad@1.1.0'], {}, config, reporter, lockfile);
    await install.init();
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '1.1.0'},
    );

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-1.1.0.tgz');

    let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    let lockFileLines = explodeLockfile(lockFileWritten);
    assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
    assert.equal(lockFileLines.length, 3);
    assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-1.1.0.tgz'), -1);

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

test.concurrent('add should not make package.json strict', async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-no-strict';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runAdd({}, ['left-pad@^1.1.0'], fixture, async (config) => {
    // Make sure left-pad is added and the resulting dependencies are sorted properly.
    expect(
      await fs.readFile(path.join(config.cwd, 'package.json')),
    ).toMatchSnapshot();

    await fs.unlink(path.join(config.cwd, `${mirrorPath}/left-pad-*.tgz`));
    await fs.unlink(path.join(config.cwd, 'package.json'));
    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
  });
});

test.concurrent('add --save-exact should not make all package.json strict', async (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-no-strict-all';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runAdd({saveExact: true}, ['left-pad@1.1.0'], fixture, async (config) => {
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {
        'left-pad': '1.1.0',
        'mime-types': '^2.0.0',
      },
    );

    await fs.unlink(path.join(config.cwd, `${mirrorPath}/left-pad-1.1.0.tgz`));
    await fs.unlink(path.join(config.cwd, 'package.json'));
    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
  });
});

test.concurrent('add with new dependency should be deterministic 3', async (): Promise<void> => {
  let fixture = 'install-should-cleanup-when-package-json-changed-3';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runAdd({}, [], fixture, async (config, reporter) => {
    // expecting yarn check after installation not to fail

    await fs.copy(path.join(cwd, 'yarn.lock.after'), path.join(cwd, 'yarn.lock'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    let lockfile = await createLockfile(config.cwd);
    let install = new Install({}, config, reporter, lockfile);
    await install.init();
    let allCorrect = true;
    try {
      await check(config, reporter, {}, []);
    } catch (err) {
      allCorrect = false;
    }
    expect(allCorrect).toBe(true);

    // cleanup
    await fs.unlink(path.join(config.cwd, 'yarn.lock'));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

test.concurrent('add should update a dependency to yarn and mirror (PR import scenario 2)', async (): Promise<void> => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11 via
  // a change in package.json,
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-import-pr-2';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1'),
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    await fs.unlink(path.join(config.cwd, 'package.json'));
    await fs.copy(path.join(cwd, 'package.json.after'), path.join(cwd, 'package.json'));

    return runAdd({}, [], fixture, async (config) => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '~1.23.0',
      ));
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.1.11',
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileWritten);
      assert.equal(lockFileLines[0], 'mime-db@~1.23.0:');
      assert.notEqual(lockFileLines[2].indexOf('resolved mime-db-'), -1);
      assert.equal(lockFileLines[3], 'mime-types@2.1.11:');
      assert.notEqual(lockFileLines[5].indexOf('resolved mime-types-2.1.11.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 4);
      let newFilesInMirror = mirror.filter((elem): boolean => {
        return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
      });

      assert.equal(newFilesInMirror.length, 2);

      await fs.unlink(newFilesInMirror[0].absolute);
      await fs.unlink(newFilesInMirror[1].absolute);

      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test.concurrent('install --initMirror should add init mirror deps from package.json',
(): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-init-mirror';

  // initMirror gets converted to save flag in cli/install.js
  return runAdd({}, [], fixture, async (config) => {
    assert.equal(await getPackageVersion(config, 'mime-types'), '2.0.0');
    assert(semver.satisfies(await getPackageVersion(config, 'mime-db'), '~1.0.1'));

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 2);
    assert.equal(mirror[0].relative.indexOf('mime-db-1.0.'), 0);
    assert.equal(mirror[1].relative, 'mime-types-2.0.0.tgz');

    let lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    let lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 8);
    assert.equal(lockFileLines[0].indexOf('mime-db@'), 0);
    assert.equal(lockFileLines[3].indexOf('mime-types@2.0.0'), 0);

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'yarn.lock'));

  });
});

test.concurrent('add with new dependency should be deterministic', async (): Promise<void> => {
  // mime-types@2.0.0->mime-db@1.0.3 is saved in local mirror and is deduped
  // install mime-db@1.23.0 should move mime-db@1.0.3 deep into mime-types

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-deterministic';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1'),
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    return runAdd({}, ['mime-db@^1.23.0'], fixture, async (config) => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '~1.23.0',
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
          'mime-db': '^1.23.0',
        },
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileWritten);
      assert.equal(lockFileLines.length, 11);


      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, 'mime-db-1.23.0.tgz');

      await fs.unlink(mirror[1].absolute);
      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

// TODO https://github.com/facebook/yarn/issues/79
xit('add with new dependency should be deterministic 2', async (): Promise<void> => {
  // mime-types@2.0.0->mime-db@1.0.1 is saved in local mirror and is deduped
  // install mime-db@1.0.3 should replace mime-db@1.0.1 in root

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-deterministic-2';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'mime-db'),
      '1.0.1',
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    return runAdd({}, ['mime-db@1.0.3'], fixture, async (config) => {
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

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileWritten);
      assert.equal(lockFileLines.length, 8);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 3);
      assert.equal(mirror[1].relative, 'mime-db-1.0.3.tgz');

      await fs.unlink(mirror[1].absolute);
      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test.concurrent('add with offline mirror', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  return runAdd({}, ['is-array@^1.0.1'], 'install-with-save-offline-mirror', async (config) => {
    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === path.join(mirrorPath, 'is-array-1.0.1.tgz');
    }) !== -1);

    let rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert.equal(lockfile['is-array@^1.0.1']['resolved'],
      'is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a');

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

test.concurrent('install with --save and without offline mirror', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  return runAdd({}, ['is-array@^1.0.1'], 'install-with-save-no-offline-mirror', async (config) => {

    let allFiles = await fs.walk(config.cwd);

    assert(allFiles.findIndex((file): boolean => {
      return file.relative === `${mirrorPath}/is-array-1.0.1.tgz`;
    }) === -1);

    let rawLockfile = await fs.readFile(path.join(config.cwd, constants.LOCKFILE_FILENAME));
    let lockfile = parse(rawLockfile);
    assert.equal(lockfile['is-array@^1.0.1']['resolved'],
      'https://registry.npmjs.org/is-array/-/is-array-1.0.1.tgz#e9850cc2cc860c3bc0977e84ccf0dd464584279a');

    await fs.unlink(path.join(config.cwd, mirrorPath));
    await fs.unlink(path.join(config.cwd, 'package.json'));
  });
});

test.concurrent('upgrade scenario', (): Promise<void> => {
  // left-pad first installed 0.0.9 then updated to 1.1.0
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';

  async function clean(cwd): Promise<void> {
    await fs.unlink(path.join(cwd, mirrorPath));
    await fs.unlink(path.join(cwd, 'yarn.lock'));
    await fs.unlink(path.join(cwd, 'package.json'));
  }

  return runAdd({}, ['left-pad@0.0.9'], 'install-upgrade-scenario', async (config): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '0.0.9',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '0.0.9'},
    );

    let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    let lockFileLines = explodeLockfile(lockFileWritten);
    assert.equal(lockFileLines[0], 'left-pad@0.0.9:');
    assert.equal(lockFileLines.length, 3);
    assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-0.0.9.tgz'), -1);

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-0.0.9.tgz');

    return runAdd({}, ['left-pad@1.1.0'], 'install-upgrade-scenario', async (config) => {
      assert.equal(
        await getPackageVersion(config, 'left-pad'),
        '1.1.0',
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
        {'left-pad': '1.1.0'},
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileWritten);
      assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
      assert.equal(lockFileLines.length, 3);
      assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-1.1.0.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 2);
      assert.equal(mirror[1].relative, 'left-pad-1.1.0.tgz');

      await clean(config.cwd);
    });
  }, clean);
});

test.concurrent('upgrade scenario 2 (with sub dependencies)', async (): Promise<void> => {
  // mime-types@2.0.0 is saved in local mirror and gets updated to mime-types@2.1.11
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-upgrade-scenario-2';
  let cwd = path.join(fixturesLoc, fixture);
  await fs.copy(path.join(cwd, 'yarn.lock.before'), path.join(cwd, 'yarn.lock'));
  await fs.copy(path.join(cwd, 'package.json.before'), path.join(cwd, 'package.json'));

  return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '~1.0.1'),
    );
    assert.equal(
      await getPackageVersion(config, 'mime-types'),
      '2.0.0',
    );

    return runAdd({}, ['mime-types@^2.1.11'], fixture, async (config) => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '~1.23.0',
      ));
      assert.equal(
        await getPackageVersion(config, 'mime-types'),
        '2.1.11',
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileWritten);
      assert.equal(lockFileLines[0], 'mime-db@~1.23.0:');
      assert.notEqual(lockFileLines[2].indexOf('resolved mime-db-'), -1);
      assert.equal(lockFileLines[3], 'mime-types@^2.1.11:');
      assert.notEqual(lockFileLines[5].indexOf('resolved mime-types-2.1.11.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 4);
      let newFilesInMirror = mirror.filter((elem): boolean => {
        return elem.relative !== 'mime-db-1.0.3.tgz' && elem.relative !== 'mime-types-2.0.0.tgz';
      });

      assert.equal(newFilesInMirror.length, 2);

      await fs.unlink(newFilesInMirror[0].absolute);
      await fs.unlink(newFilesInMirror[1].absolute);

      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

test.concurrent('downgrade scenario', (): Promise<void> => {
  // left-pad first installed 1.1.0 then downgraded to 0.0.9
  // files in mirror, yarn.lock, package.json and node_modules should reflect that

  return runAdd({}, ['left-pad@1.1.0'], 'install-downgrade-scenario', async (config): Promise<void> => {
    assert.equal(
      await getPackageVersion(config, 'left-pad'),
      '1.1.0',
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'left-pad': '1.1.0'},
    );

    let mirrorPath = 'mirror-for-offline';
    let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    let lockFileLines = explodeLockfile(lockFileWritten);
    assert.equal(lockFileLines[0], 'left-pad@1.1.0:');
    assert.equal(lockFileLines.length, 3);
    assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-1.1.0.tgz'), -1);

    let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    assert.equal(mirror[0].relative, 'left-pad-1.1.0.tgz');

    return runAdd({}, ['left-pad@0.0.9'], 'install-downgrade-scenario', async (config) => {
      assert.equal(
        await getPackageVersion(config, 'left-pad'),
        '0.0.9',
      );
      assert.deepEqual(
        JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
        {'left-pad': '0.0.9'},
      );

      let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      let lockFileLines = explodeLockfile(lockFileWritten);
      assert.equal(lockFileLines[0], 'left-pad@0.0.9:');
      assert.equal(lockFileLines.length, 3);
      assert.notEqual(lockFileLines[2].indexOf('resolved left-pad-0.0.9.tgz'), -1);

      let mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      assert.equal(mirror.length, 2);
      assert.equal(mirror[0].relative, 'left-pad-0.0.9.tgz');

      await fs.unlink(path.join(config.cwd, mirrorPath));
      await fs.unlink(path.join(config.cwd, 'yarn.lock'));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});

// https://github.com/yarnpkg/yarn/issues/318
test.concurrent('modules resolved multiple times should save to mirror correctly', (): Promise<void> => {
  // the package.json in this fixture has 4 transitive dependants on module which that should resolve to
  // which@^1.0.5, which@^1.1.1, which@^1.2.8, which@^1.2.9:
  //   version "1.2.11"
  //   resolved which-1.2.11.tgz#c8b2eeea6b8c1659fa7c1dd4fdaabe9533dc5e8b
  return runAdd({}, [], 'no-mirror-remote-when-duplicates', async (config): Promise<void> => {
    const mirrorPath = 'mirror-for-offline';

    try {
      // check that which module was downloaded to mirror
      const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
      const whichModule = mirror.find((elem): any => elem.relative.match(/which-1.*\.tgz/));
      expect(whichModule).toBeDefined();

      const lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const lockFileLines = explodeLockfile(lockFileWritten);

      // no entry in lockfile that resolves to https
      const httpResolved = lockFileLines.find((elem): any => elem.match(/resolved "https:\/\//));
      expect(httpResolved).toBeUndefined();

      // which dependency must be resolved to file in local mirror
      const whichResolved = lockFileLines.find((elem): any => elem.match(/ {2}resolved which-1.*\.tgz#.*/));
      expect(whichResolved).toBeDefined();
    } finally {
      await fs.unlink(path.join(config.cwd, mirrorPath));
    }
  });
});

test.concurrent('add should put a git dependency to mirror', (): Promise<void> => {
  let mirrorPath = 'mirror-for-offline';
  let fixture = 'install-git-mirror';

  return runAdd({}, ['mime-db@https://github.com/jshttp/mime-db.git#1.24.0'], fixture,
  async (config): Promise<void> => {
    assert(semver.satisfies(
      await getPackageVersion(config, 'mime-db'),
      '1.24.0'),
    );
    const mirror = await fs.walk(path.join(config.cwd, mirrorPath));
    assert.equal(mirror.length, 1);
    expect(mirror[0].relative).toMatch(/mime-db\.git.*/);

    let lockFileWritten = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    let lockFileLines = explodeLockfile(lockFileWritten);
    // lock file contains mirror resolved line
    expect(lockFileLines.find((line) => line.match(/.*resolved mime-db\.git\-.*/))).toBeDefined();

    // can reinstall, now from mirror
    await fs.unlink(path.join(config.cwd, 'node_modules'));
    return runInstall({}, path.join('..', 'add', fixture), async (config): Promise<void> => {
      assert(semver.satisfies(
        await getPackageVersion(config, 'mime-db'),
        '1.24.0'),
      );
      await fs.unlink(path.join(config.cwd, mirrorPath));
      await fs.unlink(path.join(config.cwd, 'package.json'));
    });
  });
});
