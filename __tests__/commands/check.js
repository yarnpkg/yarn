/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import * as checkCmd from '../../src/cli/commands/check.js';
import {run as buildRun} from './_helpers.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'check');

const runCheck = buildRun.bind(
  null,
  reporters.ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return checkCmd.run(config, reporter, flags, args);
  },
);

test('--verify-tree should report wrong version ', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-version-mismatch');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test('--verify-tree should report missing dependency ',
async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-not-found');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test('--verify-tree should pass on hoisted dependency ',
async (): Promise<void> => {
  await runCheck([], {verifyTree: true}, 'verify-tree-hoisted');
});

test('--verify-tree should check dev dependencies ',
async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-dev');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test('--verify-tree should check skip dev dependencies if --production flag passed',
async (): Promise<void> => {
  await runCheck([], {verifyTree: true, production: true}, 'verify-tree-dev-prod');
});

test('--verify-tree should check skip deeper dev dependencies',
async (): Promise<void> => {
  await runCheck([], {verifyTree: true, production: true}, 'verify-tree-dev-deep');
});
