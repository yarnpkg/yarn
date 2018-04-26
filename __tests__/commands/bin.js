/* @flow */

import {run as buildRun} from './_helpers.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {run} from '../../src/cli/commands/bin.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'bin');
const runBin = buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  return run(config, reporter, flags, args);
});

test('run bin with no arguments should return the folder where are stored the binaries', (): Promise<void> => {
  return runBin([], {}, '../install/install-production-bin', (config, reporter): ?Promise<void> => {
    expect(reporter.getBufferText()).toMatch(/[\\\/]node_modules[\\\/]\.bin[\\\/]?$/);
  });
});

test('run bin with an arguments should return the location of the binary', (): Promise<void> => {
  return runBin(['rimraf'], {}, '../install/install-production-bin', (config, reporter): ?Promise<void> => {
    expect(reporter.getBufferText()).toMatch(/[\\\/]node_modules[\\\/]\.bin[\\\/]rimraf$/);
  });
});
