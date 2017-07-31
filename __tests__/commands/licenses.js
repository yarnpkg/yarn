/* @flow */

import {JSONReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as licenses} from '../../src/cli/commands/licenses.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'licenses');

const runLicenses = buildRun.bind(
  null,
  JSONReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    await licenses(config, reporter, flags, args);
    return getStdout();
  },
);

test('lists all licenses of the dependencies with the --json argument', async (): Promise<void> => {
  await runLicenses(['list'], {json: true}, '', (config, reporter, stdout) => {
    expect(stdout).toMatchSnapshot();
  });
});

test('should genereate disclaimer on demand', async (): Promise<void> => {
  await runLicenses(['generate-disclaimer'], {json: true}, '', (config, reporter, stdout) => {
    expect(stdout).toMatchSnapshot();
  });
});
