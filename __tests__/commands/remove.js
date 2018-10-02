/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {explodeLockfile, makeConfigFromDirectory, run as buildRun, runInstall} from './_helpers.js';
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

test.concurrent('remove without --ignore-workspace-root-check should fail on the workspace root', async () => {
  await runInstall({}, 'workspaces-install-basic', async (config, reporter): Promise<void> => {
    await expect(remove(config, reporter, {}, ['left-pad'])).rejects.toThrow(
      reporter.lang('workspacesRemoveRootCheck'),
    );
  });
});

test.concurrent("remove with --ignore-workspace-root-check shouldn't fail on the workspace root", async () => {
  await runInstall({}, 'workspaces-install-basic', async (config, reporter): Promise<void> => {
    await expect(remove(config, reporter, {ignoreWorkspaceRootCheck: true}, ['left-pad'])).resolves.toBeUndefined();
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
    expect(lockFileLines).toHaveLength(4);
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

test.concurrent('removes package installed without a manifest', (): Promise<void> => {
  return runRemove(['dep-a'], {}, 'without-manifest', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a'))).toEqual(false);

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'package.json'))).dependencies).toEqual({});

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);
    expect(lockFileLines).toHaveLength(0);
  });
});

test.concurrent('removes from workspace packages', async () => {
  await runInstall({}, 'workspaces-install-basic', async (config, reporter): Promise<void> => {
    expect(await fs.exists(`${config.cwd}/node_modules/isarray`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/workspace-child/node_modules/isarray`)).toEqual(false);

    const childConfig = await makeConfigFromDirectory(`${config.cwd}/workspace-child`, reporter);
    await remove(childConfig, reporter, {}, ['isarray']);
    await check(childConfig, reporter, {verifyTree: true}, []);

    expect(JSON.parse(await fs.readFile(path.join(config.cwd, 'workspace-child/package.json'))).dependencies).toEqual(
      {},
    );

    expect(await fs.exists(`${config.cwd}/node_modules/isarray`)).toEqual(false);
    expect(await fs.exists(`${config.cwd}/workspace-child/node_modules/isarray`)).toEqual(false);

    const lockFileContent = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    const lockFileLines = explodeLockfile(lockFileContent);

    expect(lockFileLines).toHaveLength(9);
    expect(lockFileLines[0]).toEqual('left-pad@1.1.3:');
  });
});

test.concurrent('preserves unaffected bin links after removing workspace packages', async () => {
  await runInstall({binLinks: true}, 'workspaces-install-bin', async (config, reporter): Promise<void> => {
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/touch`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/workspace-1`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/workspace-1`)).toEqual(true);

    // remove package
    const childConfig = await makeConfigFromDirectory(`${config.cwd}/packages/workspace-1`, reporter, {binLinks: true});
    await remove(childConfig, reporter, {}, ['left-pad']);
    await check(childConfig, reporter, {verifyTree: true}, []);

    expect(
      JSON.parse(await fs.readFile(path.join(config.cwd, 'packages/workspace-1/package.json'))).devDependencies,
    ).toEqual({});

    // bin links should be preserved
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/touch`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/workspace-1`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/workspace-1`)).toEqual(true);
  });
});
