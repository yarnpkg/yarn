/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as upgradeInteractive} from '../../src/cli/commands/upgrade-interactive.js';
import * as reporters from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'upgrade-interactive');
const runUpgrade = buildRun.bind(null, ConsoleReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  config.commandName = 'upgrade-interactive';
  return upgradeInteractive(config, reporter, flags, args);
});

test.concurrent('throws if lockfile is out of date', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});
  return new Promise(async resolve => {
    try {
      await runUpgrade([], {}, 'lockfile-outdated');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('lockfileOutdated'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('exits with success if no upgrades', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});
  return runUpgrade([], {}, 'up-to-date', (config, rep, install, output): ?Promise<void> => {
    expect(output()).toContain(reporter.lang('allDependenciesUpToDate'));
  });
});
