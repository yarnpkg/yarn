/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as global} from '../../src/cli/commands/global.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const os = require('os');
const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'global');
const runGlobal = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return global(config, reporter, flags, args);
  },
);

function getGlobalPath(prefix, name): string {
  if (process.platform === 'win32') {
    return path.join(prefix, name);
  } else {
    return path.join(prefix, 'bin', name);
  }
}

function getTempGlobalFolder(): string {
  return path.join(os.tmpdir(), `yarn-global-${Math.random()}`);
}

test.concurrent('add without flag', (): Promise<void> => {
  return runGlobal(['add', 'react-native-cli'], {}, 'add-without-flag', async (config) => {
    assert.ok(await fs.exists(path.join(config.globalFolder, 'node_modules', 'react-native-cli')));
    assert.ok(await fs.exists(path.join(config.globalFolder, 'node_modules', '.bin', 'react-native')));
  });
});

test.concurrent('add with prefix flag', (): Promise<void> => {
  const tmpGlobalFolder = getTempGlobalFolder();
  return runGlobal(['add', 'react-native-cli'], {prefix: tmpGlobalFolder}, 'add-with-prefix-flag', async (config) => {
    assert.ok(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native')));
  });
});

// don't run this test in `concurrent`, it will affect other tests
test('add with PREFIX enviroment variable', (): Promise<void> => {
  const tmpGlobalFolder = getTempGlobalFolder();
  const envPrefix = process.env.PREFIX;
  process.env.PREFIX = tmpGlobalFolder;
  return runGlobal(['add', 'react-native-cli'], {}, 'add-with-prefix-env', async (config) => {
    assert.ok(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native')));
    // restore env
    process.env.PREFIX = envPrefix;
  });
});
