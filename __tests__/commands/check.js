/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import * as checkCmd from '../../src/cli/commands/check.js';
import {run as buildRun} from './_helpers.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'check');

const runCheck = buildRun.bind(
  null,
  reporters.ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    // config.registries.yarn.homeConfigLoc = path.join(config.cwd, '.yarnrc');
    return checkCmd.run(config, reporter, flags, args);
  },
);

test('--commonjs should report wrong version ', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {'commonjs': true}, 'commonjs-version-mismatch');
  } catch (e) {
    thrown = true;
  }
  assert(thrown);
});

test('--commonjs should report missing dependency ',
async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {'commonjs': true}, 'commonjs-not-found');
  } catch (e) {
    thrown = true;
  }
  assert(thrown);
});

test('--commonjs should pass on hoisted dependency ',
async (): Promise<void> => {
  let thrown = false;
  await runCheck([], {'commonjs': true}, 'commonjs-hoisted');
  assert(!thrown);
});

// TODO --dev-dependencies non-production
// TODO optional-dependencies
// TODO optional-dependencies + wrong version ??
// TODO exotic dependency version

