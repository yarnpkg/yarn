/* @flow */

import {JSONReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as licenses} from '../../src/cli/commands/licenses.js';
import Config from '../../src/config.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'licenses');

const runLicenses = buildRun.bind(
  null,
  JSONReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    reporter.disableProgress();
    await licenses(config, reporter, flags, args);
    return getStdout();
  },
);

type Outputs = {
  stdout: string,
  consoleout: string,
};

async function runLicensesWithConsole(
  args: Array<string>,
  flags: Object,
  name: string,
  callback: (Config, JSONReporter, Outputs) => void,
): Promise<void> {
  let consoleout = '';
  const console_log = jest.spyOn(console, 'log').mockImplementation(line => {
    consoleout += (line || '') + '\n';
  });
  try {
    await buildRun(
      JSONReporter,
      fixturesLoc,
      async (args, flags, config, reporter, lockfile, getStdout): Promise<Outputs> => {
        reporter.disableProgress();
        await licenses(config, reporter, flags, args);
        console_log.mockRestore();
        return {stdout: getStdout(), consoleout};
      },
      args,
      flags,
      name,
      callback,
    );
  } finally {
    // Make sure console.log is restored if anything goes wrong
    console_log.mockRestore();
  }
}

test('list should show licenses of dependencies', async (): Promise<void> => {
  await runLicenses(['list'], {}, '', (config, reporter, stdout) => {
    expect(stdout).toMatchSnapshot();
  });
});

test('generate-disclaimer should show license texts of dependencies', async (): Promise<void> => {
  await runLicensesWithConsole(['generate-disclaimer'], {}, '', (config, reporter, output) => {
    expect(output.stdout).toMatchSnapshot();
    expect(output.consoleout).toMatchSnapshot();
  });
});
