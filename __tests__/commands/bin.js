/* @flow */

import {run as buildRun, runInstall} from './_helpers.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {run} from '../../src/cli/commands/bin.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'bin');
const runBin = buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  return run(config, reporter, flags, args);
});

test('running bin without arguments should return the folder where the binaries are stored', (): Promise<void> => {
  return runBin([], {}, '../install/install-production-bin', (config, reporter): ?Promise<void> => {
    expect(reporter.getBufferText()).toMatch(/[\\\/]node_modules[\\\/]\.bin[\\\/]?$/);
  });
});

test('running bin with a binary name as the argument should return its full path', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-production-bin', async (config): ?Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {}, ['rimraf']);
    expect(reporter.getBufferText()).toMatch(/[\\\/]node_modules[\\\/]\.bin[\\\/]rimraf$/);
  });
});
