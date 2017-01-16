/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import * as checkCmd from '../../src/cli/commands/check.js';
import {run as buildRun} from './_helpers.js';
import assert from 'assert';

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

test('--commonjs should report wrong version ', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {commonjs: true}, 'commonjs-version-mismatch');
  } catch (e) {
    thrown = true;
  }
  assert(thrown);
});

test('--commonjs should report missing dependency ',
async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {commonjs: true}, 'commonjs-not-found');
  } catch (e) {
    thrown = true;
  }
  assert(thrown);
});

test('--commonjs should pass on hoisted dependency ',
async (): Promise<void> => {
  await runCheck([], {commonjs: true}, 'commonjs-hoisted');
});

test('--commonjs should check dev dependencies ',
async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {commonjs: true}, 'commonjs-dev');
  } catch (e) {
    thrown = true;
  }
  assert(thrown);
});

test('--commonjs should check skip dev dependencies if --production flag passed',
async (): Promise<void> => {
  await runCheck([], {commonjs: true, production: true}, 'commonjs-dev-prod');
});

test('--commonjs should check skip deeper dev dependencies',
async (): Promise<void> => {
  await runCheck([], {commonjs: true, production: true}, 'commonjs-dev-deep');
});

