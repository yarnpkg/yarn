/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import {run as bin} from '../../src/cli/commands/bin.js';
import {run as buildRun} from './_helpers.js';
import assert from 'assert';
import path from 'path';
import sinon from 'sinon';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 6000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'bin');
const runBin = buildRun.bind(
  null,
  reporters.ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return bin(config, reporter, flags, args);
  },
);

let sandbox;
let logSpy;

beforeAll(() => {
  sandbox = sinon.sandbox.create();
  logSpy = sandbox.spy(console, 'log');
});

afterAll(() => {
  sandbox.restore();
});

afterEach(() => {
  sandbox.reset();
});

test.concurrent('should output correct bin path when executed from package root', 
(): Promise<void> => {
  return runBin([], {}, '', (config, reporter) => {
    const expectedBinPath = path.join(config.cwd, 'node_modules', '.bin');
    assert(logSpy.calledWith(expectedBinPath));
  });
});

test.skip('should output correct bin path when executed from subdir', 
(): Promise<void> => {
  return runBin([], {}, 'subdir', (config, reporter) => {
    const expectedBinPath = path.join(config.cwd, 'node_modules', '.bin');
    assert(logSpy.calledWith(expectedBinPath));
  });
});
