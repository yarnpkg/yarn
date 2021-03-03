/* @flow */

import {run as buildRun, runInstall} from './_helpers.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {run} from '../../src/cli/commands/bin.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'bin');
const runBin = buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  return run(config, reporter, flags, args);
});
const runInWorkspacePackage = function(cwd, config, reporter, flags, args): Promise<void> {
  const originalCwd = config.cwd;
  config.cwd = path.join(originalCwd, cwd);
  const retVal = run(config, reporter, flags, args);
  retVal.then(() => {
    config.cwd = originalCwd;
  });
  return retVal;
};

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

test('should use .bin in workspace node modules respectively', (): Promise<void> => {
  return runInstall({binLinks: true}, 'workspaces-install-link-bin-2-versions', async (config): ?Promise<void> => {
    const reporter1 = new BufferReporter();
    await runInWorkspacePackage('packages/workspace-1', config, reporter1, {}, ['myBin']);
    expect(reporter1.getBufferText()).toMatch(/[\\\/]workspace-1[\\\/]node_modules[\\\/]\.bin[\\\/]myBin$/);

    const reporter2 = new BufferReporter();
    await runInWorkspacePackage('packages/workspace-2', config, reporter2, {}, ['myBin']);
    expect(reporter2.getBufferText()).toMatch(/[\\\/]workspace-2[\\\/]node_modules[\\\/]\.bin[\\\/]myBin$/);
  });
});
