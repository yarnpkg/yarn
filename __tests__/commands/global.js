/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as global} from '../../src/cli/commands/global.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

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

test.concurrent('add without flag', (): Promise<void> => {
  return runGlobal(['add', 'react-native-cli'], {}, 'add-without-flag', async (config) => {
    assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'react-native-cli')));
    assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'react-native')));
  });
});
