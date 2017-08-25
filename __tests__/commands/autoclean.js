/* @flow */

import * as fs from '../../src/util/fs.js';
import {run} from './_helpers.js';
import {run as autoclean} from '../../src/cli/commands/autoclean.js';
import {BufferReporter, ConsoleReporter} from '../../src/reporters/index.js';
import {CLEAN_FILENAME} from '../../src/constants.js';
import Config from '../../src/config.js';
import path from 'path';

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'autoclean');

async function runAutoclean(
  flags: Object,
  name: string,
  checkSteps?: ?(config: Config, output: any) => ?Promise<void>,
): Promise<void> {
  await run(
    BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      await autoclean(config, reporter, flags, []);
    },
    [],
    flags,
    name,
  );
}

test.concurrent('tells user to run with --init when .yarnclean does not exist', (): Promise<void> => {
  const reporter = new ConsoleReporter({});
  return runAutoclean({}, 'not-initialized', (config, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanDoesNotExist', CLEAN_FILENAME));
  });
});

test.concurrent('tells user to run with --init when .yarnclean does not exist and --force', (): Promise<void> => {
  const reporter = new ConsoleReporter({});
  return runAutoclean({force: true}, 'not-initialized', (config, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanDoesNotExist', CLEAN_FILENAME));
  });
});

test.concurrent('tells user to edit .yarnclean after init', (): Promise<void> => {
  const reporter = new ConsoleReporter({});
  return runAutoclean({init: true}, 'not-initialized', (config, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanCreatedFile', CLEAN_FILENAME));
  });
});

test.concurrent('creates .yarnclean when --init passed', async () => {
  await runAutoclean({init: true}, 'not-initialized', async (config, output): ?Promise<void> => {
    expect(await fs.exists(`${config.cwd}/.yarnclean`)).toEqual(true);
  });
});

test.concurrent('tells user to run with --force when .yarnclean exists', (): Promise<void> => {
  const reporter = new ConsoleReporter({});
  return runAutoclean({}, 'initialized', (config, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanRequiresForce', CLEAN_FILENAME));
  });
});

test.concurrent('tells user file exists already when --init and .yarnclean exists', (): Promise<void> => {
  const reporter = new ConsoleReporter({});
  return runAutoclean({init: true}, 'initialized', (config, output): ?Promise<void> => {
    expect(output).toContain(reporter.lang('cleanAlreadyExists', CLEAN_FILENAME));
  });
});

test.concurrent('runs clean when --force passed and .yarnclean exists', async () => {
  await runAutoclean({force: true}, 'initialized', async (config, output): ?Promise<void> => {
    expect(await fs.exists(`${config.cwd}/node_modules/left-pad/README.md`)).toEqual(false);
  });
});
