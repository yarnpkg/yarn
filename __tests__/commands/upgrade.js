/* @flow */

import {Reporter} from '../../src/reporters/index.js';
import {run as upgrade} from '../../src/cli/commands/upgrade.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import assert from 'assert';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const stream = require('stream');
const path = require('path');
const os = require('os');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'upgrade');

async function runUpgrade(
  flags: Object,
  args: Array<string>,
  name: string,
  checkUpgrade?: ?(config: Config, reporter: Reporter) => ?Promise<void>,
): Promise<void> {
  const dir = path.join(fixturesLoc, name);
  const cwd = path.join(
    os.tmpdir(),
    `yarn-${path.basename(dir)}-${Math.random()}`,
  );
  await fs.unlink(cwd);
  await fs.copy(dir, cwd);

  for (const {basename, absolute} of await fs.walk(cwd)) {
    if (basename.toLowerCase() === '.ds_store') {
      await fs.unlink(absolute);
    }
  }

  let out = '';
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  const reporter = new reporters.NoopReporter({stdout});

  // create directories
  await fs.mkdirp(path.join(cwd, '.yarn'));
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    const config = new Config(reporter);
    await config.init({
      cwd,
      globalFolder: path.join(cwd, '.yarn/.global'),
      cacheFolder: path.join(cwd, '.yarn'),
      linkFolder: path.join(cwd, '.yarn/.link'),
    });

    await upgrade(config, reporter, flags, args);

    if (checkUpgrade) {
      await checkUpgrade(config, reporter);
    }

  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}

test.concurrent('throws if lockfile is out of date', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve) => {
    try {
      await runUpgrade({}, [], 'lockfile-outdated');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('lockfileOutdated'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('works with no arguments', (): Promise<void> => {
  return runUpgrade({}, [], 'no-args', async (config): ?Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('left-pad-1.0.0.tgz') === -1);
    // the below test passes when it should fail
    // manifest doesn't get updated when ran without args
    assert.deepEqual(pkg.dependencies, {'left-pad': '^1.0.0'});
  });
});

test.concurrent('works with single argument', (): Promise<void> => {
  return runUpgrade({}, ['max-safe-integer'], 'single-package', async (config): ?Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('left-pad-1.0.0.tgz') >= 0);
    assert(lockfile.indexOf('max-safe-integer-1.0.0.tgz') === -1);
    assert.equal(pkg.dependencies['left-pad'], '^1.0.0');
    assert.notEqual(pkg.dependencies['max-safe-integer'], '^1.0.0');
  });
});

test.concurrent('works with multiple arguments', (): Promise<void> => {
  return runUpgrade({}, ['left-pad', 'max-safe-integer'], 'multiple-packages',
    async (config): ?Promise<void> => {
      const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

      assert(lockfile.indexOf('left-pad-1.0.0.tgz') === -1);
      assert(lockfile.indexOf('max-safe-integer-1.0.0.tgz') === -1);
      assert(lockfile.indexOf('is-negative-zero-1.0.0.tgz') >= 0);
      assert.notEqual(pkg.dependencies['left-pad'], '^1.0.0');
      assert.notEqual(pkg.dependencies['max-safe-integer'], '^1.0.0');
      assert.equal(pkg.dependencies['is-negative-zero'], '^1.0.0');
    },
  );
});

test.concurrent('respects dependency type', (): Promise<void> => {
  return runUpgrade({}, ['left-pad@^1.1.3'], 'respects-dependency-type', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert.deepEqual(pkg.dependencies, {'max-safe-integer': '^1.0.0'});
    assert.deepEqual(pkg.devDependencies, {'left-pad': '^1.1.3'});
  });
});

test.concurrent('respects --ignore-engines flag', (): Promise<void> => {
  return runUpgrade({ignoreEngines: true}, ['hawk@0.10'], 'respects-ignore-engines-flag',
    async (config): ?Promise<void> => {
      const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

      assert(lockfile.indexOf('hawk@0.10') >= 0);
      assert.deepEqual(pkg.dependencies, {hawk: '0.10'});
    },
  );
});
