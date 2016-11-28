/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import type Config from '../../src/config.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as global} from '../../src/cli/commands/global.js';
import stringify from '../../src/lockfile/stringify.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const os = require('os');
const path = require('path');

// call getGlobalPath with the path to GLOBAL_BIN as the 1st argument to get the same path
// for all platforms – path-to-temp-folder/.yarn-tmpbin/bin
const GLOBAL_BIN = process.platform === 'win32' ? path.join('.yarn-tmpbin', 'bin') : '.yarn-tmpbin';

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'global');
const runGlobal = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    if (typeof flags.prefix === 'undefined' && !flags._noPrefix) {
      flags.prefix = path.join(config.cwd, GLOBAL_BIN);
    }
    delete flags._noPrefix;
    return global(config, reporter, flags, args);
  },
);

function getGlobalPath(prefix, name = ''): string {
  if (process.platform === 'win32') {
    return path.join(prefix, name);
  } else {
    return path.join(prefix, 'bin', name);
  }
}

function getTempGlobalFolder(): string {
  return path.join(os.tmpdir(), `yarn-global-${Math.random()}`);
}

/**
 * Test that all the links in the `yarn global bin` folder are from globally
 * installed packages and that all the bins from the packages installed
 */
async function testFilesInGlobalBin(
  config: Config,
  expected: Array<string>,
  userCmd?: Array<string> = [],
): Promise<void> {
  if (!config.binLinks) {
    expected = [];
  }
  if (process.platform === 'win32') {
    expected = expected.reduce((a, b) => {
      return a.concat(b, `${b}.cmd`);
    }, []);
  }
  const expectedList = [...expected, ...userCmd].sort().join(',');

  // read the content of the folder
  // global function change config.cwd to config.globalFolder,
  // go one level up to be on the .yarn folder
  const binFolder = getGlobalPath(path.join(config.cwd, '..', GLOBAL_BIN));

  // when the folder not exist set files to empty array
  let files = [];
  try {
    files = await fs.readdir(binFolder);
  } catch (ex) {}

  assert.equal(files.sort().join(','), expectedList);
}

// Make sure the file was updated by comparing the first 10 characters
async function compareContent(config: Config): Promise<void> {
  if (!config.binLinks) {
    return;
  }
  const binFolder = getGlobalPath(path.join(config.cwd, '..', GLOBAL_BIN));
  const expectedFolder = path.join(config.cwd, '..', 'expected-bin-files');
  const files = await fs.readdir(expectedFolder);
  for (const file of files) {
    const [win, cmd] = [process.platform === 'win32', file.endsWith('.cmd')];
    if (win && cmd || !win && !cmd) {
      const actual = await fs.readFile(path.join(binFolder, file));
      const expected = await fs.readFile(path.join(expectedFolder, file));
      assert.equal(actual.substr(0, 10), expected.substr(0, 10));
    }
  }
}

test.concurrent('add with prefix flag', (): Promise<void> => {
  const tmpGlobalFolder = getTempGlobalFolder();
  return runGlobal(['add', 'react-native-cli'], {prefix: tmpGlobalFolder}, 'add-with-prefix-flag', async (config) => {
    assert.ok(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native')));
  });
});

test.concurrent('add with .yarnrc file', (): Promise<void> => {
  const tmpGlobalFolder = getTempGlobalFolder();
  return runGlobal(['add', 'react-native-cli'], {_noPrefix: true}, 'add-with-yarnrc-file', async (config) => {
    assert.ok(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native')));
  }, async (cwd) => {
    // create .yarnrc file and place it in .yarn-global
    const loc = path.join(cwd, '.yarn-global', '.yarnrc');
    await fs.mkdirp(path.join(cwd, '.yarn-global'));
    await fs.writeFilePreservingEol(loc, `${stringify({prefix: tmpGlobalFolder})}\n`);
  });
});

// don't run this test in `concurrent`, it will affect other tests
test('add with PREFIX environment variable', (): Promise<void> => {
  const tmpGlobalFolder = getTempGlobalFolder();
  const envPrefix = process.env.PREFIX;
  process.env.PREFIX = tmpGlobalFolder;
  return runGlobal(['add', 'react-native-cli'], {_noPrefix: true}, 'add-with-prefix-env', async (config) => {
    // restore env
    process.env.PREFIX = envPrefix;
    assert.ok(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native')));
  });
});

function globalAddBins(binLinks): Function {
  return (): Promise<void> => {
    return runGlobal(['add', 'react-native-cli'], {binLinks}, 'global-add-with-bin', async (config) => {
      assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'react-native-cli')));
      const binExist = await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'react-native'));
      assert.ok(config.binLinks ? binExist : !binExist);
      await testFilesInGlobalBin(config, ['react-native']);
      await compareContent(config);
    });
  };
}

function globalRemoveBins(binLinks): Function {
  return (): Promise<void> => {
    // A@1 -> B@1
    // C@1
    // react-native - missing bin

    // remove A

    // result....
    // C@1 - without bin
    // react-native - with bin
    const name = 'global-remove';
    return runGlobal(['remove', 'dep-a'], {binLinks}, name, async (config, reporter) => {
      // the link for react-native was missing frol the files in the fixtures folder,
      // we expect it to be installed
      await testFilesInGlobalBin(config, ['react-native'], ['user-command']);
      assert.ok(!await fs.exists(path.join(config.cwd, 'node_modules/dep-a')));
      assert.ok(!await fs.exists(path.join(config.cwd, 'node_modules/dep-b')));
      assert.ok(await fs.exists(path.join(config.cwd, 'node_modules/dep-c')));
    });
  };
}

function globalUpgradeBins(binLinks): Function {
  return (): Promise<void> => {
    const name = 'global-update-with-bin';
    return runGlobal(['upgrade', 'react-native-cli'], {binLinks}, name, async (config) => {
      await testFilesInGlobalBin(config, ['react-native']);
      await compareContent(config);
    });
  };
}

// flags.binLinks = true
test.concurrent('global add: package with bin, flags: {binlinks: true}', globalAddBins(true));
test.concurrent('global remove: dependencies with bins, flags: {binlinks: true}', globalRemoveBins(true));
test.concurrent('global upgrade: package with bin, flags: {binlinks: true}', globalUpgradeBins(true));

// flags.binLinks = false
test.concurrent('global add: package with bin, flags: {binlinks: false}', globalAddBins(false));
test.concurrent('global remove: dependencies with bins, flags: {binlinks: false}', globalRemoveBins(false));
test.concurrent('global upgrade: package with bin, flags: {binlinks: false}', globalUpgradeBins(false));
