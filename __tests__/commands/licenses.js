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
    reporter.disableProgress();
    await licenses(config, reporter, flags, args);
    return getStdout();
  },
);

async function runLicensesWithConsole(args, flags, name, callback): Promise<void> {
  let consoleout = '';
  const console_log = jest.spyOn(console, 'log').mockImplementation(line => {
    consoleout += (line || '') + '\n';
  });
  try {
    await buildRun(
      JSONReporter,
      fixturesLoc,
      async (args, flags, config, reporter, lockfile, getStdout): Promise<{stdout: string, consoleout: string}> => {
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

test('lists all licenses of the dependencies with the --json argument', async (): Promise<void> => {
  await runLicenses(['list'], {}, '', (config, reporter, stdout) => {
    expect(stdout).toMatchSnapshot();
  });
});

test('should generate disclaimer on demand', async (): Promise<void> => {
  await runLicensesWithConsole(['generate-disclaimer'], {}, '', (config, reporter, output) => {
    expect(output.stdout).toMatchSnapshot();
    expect(output.consoleout).toMatchSnapshot();
  });
});
