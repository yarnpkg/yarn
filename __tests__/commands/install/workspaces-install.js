/* @flow */

import {run as check} from '../../../src/cli/commands/check.js';
import * as fs from '../../../src/util/fs.js';
import {runInstall} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');

test.concurrent("workspaces don't work without a configuration in .yarnrc", (): Promise<void> => {
  return runInstall({}, 'workspaces-install-enabled', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockfile.indexOf('isarray')).toBe(-1);
  });
});

test.concurrent("workspaces don't work on non private projects", async (): Promise<void> => {
  let thrown = false;
  try {
    await runInstall({}, 'workspaces-install-private');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toBe(true);
});

test.concurrent('installs workspaces into root folder', (): Promise<void> => {
  return runInstall({}, 'workspaces-install-basic', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockfile.indexOf('isarray')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('repeat-string')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('left-pad')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('right-pad')).toBeGreaterThanOrEqual(0);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'isarray'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'repeat-string'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'right-pad'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'workspace-child', 'node_modules'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'workspace-child', 'yarn.lock'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-2', 'node_modules'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-2', 'yarn.lock'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-3', 'node_modules'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-3', 'yarn.lock'))).toBe(false);
  });
});

test.concurrent('check command should work', (): Promise<void> => {
  return runInstall({checkFiles: true}, 'workspaces-install-basic', async (config, reporter): Promise<void> => {
    // check command + integrity check
    let thrown = false;
    try {
      await check(config, reporter, {integrity: true, checkFiles: true}, []);
      await check(config, reporter, {}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toBe(false);
  });
});

test.concurrent('install should fail if a workspace has a conflicting version of a dependency', async (): Promise<
  void,
> => {
  let thrown = false;
  try {
    await runInstall({}, 'workspaces-install-conflict');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toBe(true);
});
