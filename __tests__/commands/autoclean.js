/* @flow */

import * as fs from '../../src/util/fs.js';
import {run} from './_helpers.js';
import {run as autoclean} from '../../src/cli/commands/autoclean.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {CLEAN_FILENAME} from '../../src/constants.js';
import Config from '../../src/config.js';
import path from 'path';

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'autoclean');

async function runAutoclean(
  flags: Object,
  name: string,
  checkSteps: (config: Config, reporter: ConsoleReporter, output: any) => ?Promise<void>,
): Promise<void> {
  await run(
    ConsoleReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      await autoclean(config, reporter, flags, []);
    },
    [],
    flags,
    name,
    (config, reporter, install, getStdout) => {
      return checkSteps(config, reporter, getStdout());
    },
  );
}

test.concurrent('tells user to run with --init when .yarnclean does not exist', (): Promise<void> => {
  return runAutoclean({}, 'not-initialized', (config, reporter, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanDoesNotExist', CLEAN_FILENAME));
  });
});

test.concurrent('tells user to run with --init when .yarnclean does not exist and --force', (): Promise<void> => {
  return runAutoclean({force: true}, 'not-initialized', (config, reporter, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanDoesNotExist', CLEAN_FILENAME));
  });
});

test.concurrent('tells user to edit .yarnclean after init', (): Promise<void> => {
  return runAutoclean({init: true}, 'not-initialized', (config, reporter, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanCreatedFile', CLEAN_FILENAME));
  });
});

test.concurrent('creates .yarnclean when --init passed', async () => {
  await runAutoclean({init: true}, 'not-initialized', async (config, reporter, output): ?Promise<void> => {
    expect(await fs.exists(`${config.cwd}/.yarnclean`)).toEqual(true);
  });
});

test.concurrent('tells user to run with --force when .yarnclean exists', (): Promise<void> => {
  return runAutoclean({}, 'initialized', (config, reporter, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanRequiresForce', CLEAN_FILENAME));
  });
});

test.concurrent('tells user file exists already when --init and .yarnclean exists', (): Promise<void> => {
  return runAutoclean({init: true}, 'initialized', (config, reporter, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanAlreadyExists', CLEAN_FILENAME));
  });
});

test.concurrent('runs clean when --force passed and .yarnclean exists', async () => {
  await runAutoclean({force: true}, 'initialized', async (config, reporter, output): ?Promise<void> => {
    expect(await fs.exists(`${config.cwd}/node_modules/left-pad/README.md`)).toEqual(false);
  });
});

test.concurrent('runs clean even through workspaces', async () => {
  await runAutoclean({force: true}, 'workspaces', async (config): ?Promise<void> => {
    expect(await fs.exists(`${config.cwd}/node_modules/left-pad/index.js`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/left-pad/README.md`)).toEqual(false);
    expect(await fs.exists(`${config.cwd}/foo/node_modules/left-pad/index.js`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/foo/node_modules/left-pad/README.md`)).toEqual(false);
  });
});
