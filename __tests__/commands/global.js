/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as global, getBinFolder} from '../../src/cli/commands/global.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';
const isCI = require('is-ci');

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

// this test has global folder side effects, run it only in CI
if (isCI) {
  test.concurrent('add without flag', (): Promise<void> => {
    return runGlobal(['add', 'react-native-cli'], {}, 'add-without-flag', async (config) => {
      assert.ok(await fs.exists(path.join(config.globalFolder, 'node_modules', 'react-native-cli')));
      assert.ok(await fs.exists(path.join(config.globalFolder, 'node_modules', '.bin', 'react-native')));
      if (process.platform === 'win32') {
      // Test for valid shims on windows.
        assert.ok(await fs.exists(path.join(config.globalFolder, 'node_modules', '.bin', 'react-native.cmd')));
        assert.ok(!await fs.exists(path.join(config.globalFolder, 'node_modules', '.bin', 'react-native.cmd.cmd')));
      }
    });
  });
}

test.concurrent('add with prefix flag', (): Promise<void> => {
  const tmpGlobalFolder = getTempGlobalFolder();
  return runGlobal(['add', 'react-native-cli'], {prefix: tmpGlobalFolder}, 'add-with-prefix-flag', async (config) => {
    assert.ok(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native')));
    if (process.platform === 'win32') {
      // Test for valid shims on windows.
      assert.ok(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native.cmd')));
      assert.ok(!await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native.cmd.cmd')));
    }
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

if (process.platform === 'win32' && process.env.PATH && process.env.LOCALAPPDATA) {

  test.only('add with local appdata path', (): Promise<void> => {
    const envPrefix = process.env.PREFIX;
    const envAppdata = process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA : '';
    process.env.PREFIX = `${envAppdata}\\Yarn\\.bin`;
    const envPath = process.env.PATH ? process.env.PATH : '';
    const localBinPath = path.join(envAppdata, 'Yarn', '.bin');
    process.env.PATH = `${localBinPath};envPath`;
    return runGlobal(['add', 'react-native-cli'], {}, 'add-with-local-appdata-path', async (config) => {
      console.log(config.getOption('prefix'));
      assert.equal(getBinFolder(config, {}), localBinPath);
      assert.ok(await fs.exists(path.join(localBinPath, 'react-native.cmd')));
      assert.ok(!await fs.exists(path.join(localBinPath, 'react-native.cmd.cmd')));
      await fs.unlink(path.join(localBinPath, 'react-native.cmd'));
      await fs.unlink(path.join(localBinPath, 'react-native'));
      process.env.PATH = envPath;
      process.env.PREFIX = envPrefix;
    });
  });

  test.only('add without local appdata path', (): Promise<void> => {
    const envPrefix = process.env.PREFIX;
    process.env.PREFIX = '';
    const envPath = process.env.PATH ? process.env.PATH : '';
    const envAppdata = process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA : '';
    const localBinPath = path.join(envAppdata, 'Yarn', '.bin');
    process.env.PATH = envPath.replace(/\\AppData\\Local\\Yarn\\.bin/g, '');
    return runGlobal(['add', 'react-native-cli'], {}, 'add-without-local-appdata-path', async (config) => {
      console.log(config.getOption('prefix'));
      assert.notEqual(getBinFolder(config, {}), localBinPath);
      assert.ok(localBinPath.length > 0);
      assert.ok(!await fs.exists(path.join(localBinPath, 'react-native.cmd')));
      assert.ok(!await fs.exists(path.join(localBinPath, 'react-native.cmd.cmd')));
      await fs.unlink(path.join(getBinFolder(config, {}), 'react-native.cmd'));
      await fs.unlink(path.join(getBinFolder(config, {}), 'react-native'));
      process.env.PATH = envPath;
      process.env.PREFIX = envPrefix;
    });
  });
}
