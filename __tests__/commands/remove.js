/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun, explodeLockfile} from './_helpers.js';
import {run as check} from '../../src/cli/commands/check.js';
import {run as remove} from '../../src/cli/commands/remove.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'remove');
const runRemove = buildRun.bind(null, ConsoleReporter, fixturesLoc, async (args, flags, config, reporter): Promise<
  void,
> => {
  await remove(config, reporter, flags, args);
  await check(config, reporter, {verifyTree: true}, []);
});

test.concurrent('throws error with no arguments', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runRemove([], {}, '');
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
      await runRemove(['dep-b'], {}, 'npm-registry');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('moduleNotInManifest'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('removes package installed from npm registry', (): Promise<void> => {
  return runRemove(['dep-a'], {}, 'npm-registry', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a'))).toEqual(false);

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({});

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines).toHaveLength(0);
  });
});

test.concurrent('removes multiple installed packages', (): Promise<void> => {
  const args: Array<string> = ['dep-a', 'max-safe-integer'];

  return runRemove(args, {}, 'multiple-packages', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/max-safe-integer'))).toEqual(false);

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({});

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines).toHaveLength(0);
  });
});

test.concurrent('removes the whole scope when all scoped packages are removed', (): Promise<void> => {
  return runRemove(['@dengorbachev/foo', '@dengorbachev/bar'], {}, 'scoped-package', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/@dengorbachev'))).toEqual(false);

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({});

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines).toHaveLength(0);
  });
});

test.concurrent('removes a single scoped package', (): Promise<void> => {
  return runRemove(['@dengorbachev/foo'], {}, 'scoped-package', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/@dengorbachev/foo'))).toEqual(false);

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      '@dengorbachev/bar': '^1.0.0',
    });

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines).toHaveLength(3);
  });
});

test('removes subdependencies', (): Promise<void> => {
  // A@1 -> B@1
  // C@1

  // remove A

  // C@1

  return runRemove(['dep-a'], {}, 'subdependencies', async (config, reporter) => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-b'))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-c'))).toEqual(true);

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({
      'dep-c': '^1.0.0',
    });

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines).toHaveLength(3);
    expect(lockFileLines[0]).toEqual('dep-c@^1.0.0:');
  });
});

test.concurrent('can prune the offline mirror', (): Promise<void> => {
  return runRemove(['dep-a'], {}, 'prune-offline-mirror', async (config, reporter) => {
    const mirrorPath = 'mirror-for-offline';
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`))).toEqual(false);
    // dep-a depends on dep-b, so dep-b should also be pruned
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-b-1.0.0.tgz`))).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-c-1.0.0.tgz`))).toEqual(true);
  });
});
