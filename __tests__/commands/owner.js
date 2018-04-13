/* @flow */

import {JSONReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as owner} from '../../src/cli/commands/owner.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'owner');

const runOwner = buildRun.bind(
  null,
  JSONReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    reporter.disableProgress();
    await owner(config, reporter, flags, args);
    return getStdout();
  },
);

test('list should show owners', async (): Promise<void> => {
  await runOwner(['list', 'yarn'], {nonInteractive: true}, '', (config, reporter, stdout) => {
    expect(stdout).toMatchSnapshot();
  });
});
