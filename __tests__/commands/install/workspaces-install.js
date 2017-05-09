/* @flow */

import {run as check} from '../../../src/cli/commands/check.js';
import * as constants from '../../../src/constants.js';
import * as reporters from '../../../src/reporters/index.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile/wrapper.js';
import * as fs from '../../../src/util/fs.js';
import {getPackageVersion, runInstall} from '../_helpers.js';
import {promisify} from '../../../src/util/promise';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const fsNode = require('fs');
const path = require('path');
const os = require('os');

test.concurrent("workspaces don't work without a configuration in .yarnrc", (): Promise<void> => {
  return runInstall({}, 'workspaces-install-enabled', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockfile.indexOf('isarray')).toBe(-1);
  });
});

test.concurrent('installs workspaces into root folder', (): Promise<void> => {
  return runInstall({}, 'workspaces-install-basic', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockfile.indexOf('isarray')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('repeat-string')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('left-pad')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('right-pad')).toBeGreaterThanOrEqual(0);
    // TODO check node_modules
  });
});

// TODO
// aggregation
// single lock file, no sublockfiles
// common maximum version
// fail on conflict (later - install conflicts in workspaces' folders)
// fail to run yarn commands in workspaces
// check command + integrity check
// automatic CD to workspace root

