/* @flow */

import {Reporter} from '../../src/reporters/index.js';
import {explodeLockfile} from './_install.js';
import {run as remove} from '../../src/cli/commands/remove.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import assert from 'assert';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const stream = require('stream');
const path = require('path');
const os = require('os');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'remove');

async function runRemove(
  flags: Object,
  args: Array<string>,
  name: string,
  checkRemove?: ?(config: Config, reporter: Reporter) => ?Promise<void>,
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

  const reporter = new reporters.ConsoleReporter({stdout, stderr: stdout});

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

    await remove(config, reporter, flags, args);

    if (checkRemove) {
      await checkRemove(config, reporter);
    }

  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}

test.concurrent('throws error with no arguments', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runRemove({}, [], '');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('tooFewArguments', 1));
    } finally {
      resolve();
    }
  });
});

test.concurrent('throws error when package is not found', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runRemove({}, ['dep-b'], 'npm-registry');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('moduleNotInManifest'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('removes package installed from npm registry', (): Promise<void> => {
  return runRemove({}, ['dep-a'], 'npm-registry', async (config): Promise<void> => {
    assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));

    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {},
    );

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 0);
  });
});

test.concurrent('removes multiple installed packages', (): Promise<void> => {
  const args: Array<string> = ['dep-a', 'max-safe-integer'];

  return runRemove({}, args, 'multiple-packages', async (config): Promise<void> => {
    assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));
    assert(!await fs.exists(path.join(config.cwd, 'node_modules/max-safe-integer')));

    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {},
    );

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 0);
  });
});


test.concurrent('removes scoped packages', (): Promise<void> => {
  return runRemove({}, ['@scoped/package'], 'scoped-package', async (config): Promise<void> => {
    assert(!await fs.exists(path.join(config.cwd, 'node_modules/@scoped')));

    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {},
    );

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 0);
  });
});

test.concurrent('removes subdependencies', (): Promise<void> => {
  // A@1 -> B@1
  // C@1

  // remove A

  // C@1

  return runRemove({}, ['dep-a'], 'subdependencies', async (config, reporter) => {
    assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));
    assert(!await fs.exists(path.join(config.cwd, 'node_modules/dep-b')));
    assert(await fs.exists(path.join(config.cwd, 'node_modules/dep-c')));

    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies,
      {'dep-c': '^1.0.0'},
    );

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    assert.equal(lockFileLines.length, 3);
    assert.equal(lockFileLines[0], 'dep-c@^1.0.0:');
  });
});
