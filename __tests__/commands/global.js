/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as global} from '../../src/cli/commands/global.js';
import * as fs from '../../src/util/fs.js';
import mkdir from '../_temp.js';
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
  return path.join(prefix, 'bin', name);
}

function getTempGlobalFolder(): string {
  return path.join(os.tmpdir(), `yarn-global-${Math.random()}`);
}

function createTempGlobalFolder(): Promise<string> {
  return mkdir('yarn-global');
}

async function createTempPrefixFolder(): Promise<string> {
  const prefixFolder = await mkdir('yarn-prefix');
  return path.join(prefixFolder, 'bin');
}

// these tests have global folder side or prefix folder effects, run it only in CI
if (isCI) {
  test.concurrent('add without flag', (): Promise<void> => {
    return runGlobal(['add', 'react-native-cli'], {}, 'add-without-flag', async config => {
      expect(await fs.exists(path.join(config.globalFolder, 'node_modules', 'react-native-cli'))).toEqual(true);
      expect(await fs.exists(path.join(config.globalFolder, 'node_modules', '.bin', 'react-native'))).toEqual(true);
    });
  });

  test.concurrent('add with prefix flag', (): Promise<void> => {
    const tmpGlobalFolder = getTempGlobalFolder();
    return runGlobal(['add', 'react-native-cli'], {prefix: tmpGlobalFolder}, 'add-with-prefix-flag', async config => {
      expect(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native'))).toEqual(true);
    });
  });

  // don't run this test in `concurrent`, it will affect other tests
  test('add with PREFIX enviroment variable', (): Promise<void> => {
    const tmpGlobalFolder = getTempGlobalFolder();
    const envPrefix = process.env.PREFIX;
    process.env.PREFIX = tmpGlobalFolder;
    return runGlobal(['add', 'react-native-cli'], {}, 'add-with-prefix-env', async config => {
      expect(await fs.exists(getGlobalPath(tmpGlobalFolder, 'react-native'))).toEqual(true);
      // restore env
      process.env.PREFIX = envPrefix;
    });
  });
}

test.concurrent("shouldn't expose unwanted binaries", async (): Promise<void> => {
  const tmpGlobalFolder = await createTempGlobalFolder();
  const tmpPrefixFolder = await createTempPrefixFolder();
  const flags = {globalFolder: tmpGlobalFolder, prefix: tmpPrefixFolder};
  return runGlobal(['add', 'fs-kit'], flags, 'add-with-prefix-flag', async config => {
    expect(await fs.exists(path.join(tmpPrefixFolder, 'bin', 'touch'))).toEqual(false);
  });
});

test.concurrent('bin', (): Promise<void> => {
  const tmpGlobalFolder = getTempGlobalFolder();
  return runGlobal(
    ['bin'],
    {prefix: tmpGlobalFolder},
    'add-with-prefix-flag',
    (config, reporter, install, getStdout) => {
      expect(getStdout()).toContain(tmpGlobalFolder);
    },
  );
});

test.concurrent('add', async (): Promise<void> => {
  const tmpGlobalFolder = await createTempGlobalFolder();
  const tmpPrefixFolder = await createTempPrefixFolder();
  const flags = {globalFolder: tmpGlobalFolder, prefix: tmpPrefixFolder};
  return runGlobal(['add', 'react-native-cli'], flags, 'add-with-prefix-flag', async config => {
    expect(await fs.exists(path.join(tmpGlobalFolder, 'node_modules', 'react-native-cli'))).toEqual(true);
  });
});

test.concurrent('remove', async (): Promise<void> => {
  const tmpGlobalFolder = await createTempGlobalFolder();
  const tmpPrefixFolder = await createTempPrefixFolder();
  const flags = {globalFolder: tmpGlobalFolder, prefix: tmpPrefixFolder};
  return runGlobal(['add', 'react-native-cli'], flags, 'add-with-prefix-flag', () => {}).then(() => {
    return runGlobal(['remove', 'react-native-cli'], flags, 'add-with-prefix-flag', async config => {
      expect(await fs.exists(path.join(tmpGlobalFolder, 'node_modules', 'react-native-cli'))).toEqual(false);
    });
  });
});

test.concurrent('ls', async (): Promise<void> => {
  const tmpGlobalFolder = await createTempGlobalFolder();
  const tmpPrefixFolder = await createTempPrefixFolder();
  const flags = {globalFolder: tmpGlobalFolder, prefix: tmpPrefixFolder};
  return runGlobal(['add', 'react-native-cli'], flags, 'add-with-prefix-flag', () => {}).then(() => {
    return runGlobal(['ls'], flags, 'add-with-prefix-flag', (config, reporter, install, getStdout) => {
      expect(getStdout()).toContain('react-native-cli');
    });
  });
});

test.concurrent('list', async (): Promise<void> => {
  const tmpGlobalFolder = await createTempGlobalFolder();
  const tmpPrefixFolder = await createTempPrefixFolder();
  const flags = {globalFolder: tmpGlobalFolder, prefix: tmpPrefixFolder};
  return runGlobal(['add', 'react-native-cli'], flags, 'add-with-prefix-flag', () => {}).then(() => {
    return runGlobal(['list'], flags, 'add-with-prefix-flag', (config, reporter, install, getStdout) => {
      expect(getStdout()).toContain('react-native-cli');
    });
  });
});

test.concurrent('upgrade', async (): Promise<void> => {
  const tmpGlobalFolder = await createTempGlobalFolder();
  const tmpPrefixFolder = await createTempPrefixFolder();
  const flags = {globalFolder: tmpGlobalFolder, prefix: tmpPrefixFolder};
  const upgradeFlags = {globalFolder: tmpGlobalFolder, prefix: tmpPrefixFolder, latest: true};
  return runGlobal(['add', 'react-native-cli@2.0.0'], flags, 'add-with-prefix-flag', () => {}).then(() => {
    return runGlobal(
      ['upgrade', 'react-native-cli'],
      upgradeFlags,
      'add-with-prefix-flag',
      (config, reporter, install, getStdout) => {
        expect(getStdout()).toContain('react-native-cli');
        expect(getStdout()).not.toContain('react-native-cli@2.0.0');
      },
    );
  });
});
