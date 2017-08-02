/* @flow */

import {BufferReporter} from '../../src/reporters/index.js';
import {run as why} from '../../src/cli/commands/why.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'why');

async function runWhy(
  flags: Object,
  args: Array<string>,
  name: string,
  checkSteps?: ?(config: Config, reporter: BufferReporter) => ?Promise<void>,
): Promise<void> {
  const cwd = path.join(fixturesLoc, name);
  const reporter = new reporters.BufferReporter({stdout: null, stdin: null});

  try {
    const config = await Config.create({cwd}, reporter);
    await why(config, reporter, flags, args);

    if (checkSteps) {
      await checkSteps(config, reporter);
    }
  } catch (err) {
    throw new Error(`${err && err.stack}`);
  }
}

test.concurrent('throws error with no arguments', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runWhy({}, [], 'basic');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('missingWhyDependency'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('throws error with too many arguments', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runWhy({}, ['one', 'two'], 'basic');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('tooManyArguments', 1));
    } finally {
      resolve();
    }
  });
});

test.concurrent('throws error if module does not exist', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runWhy({}, ['one'], 'basic');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('whyUnknownMatch'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('should determine that the module installed because it is in dependencies', (): Promise<void> => {
  return runWhy({}, ['mime-types'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect(report[report.length - 1].data).toEqual(reporter.lang('whySpecifiedSimple', 'dependencies'));
  });
});

test.concurrent('should determine that the module installed because it is in devDependencies', (): Promise<void> => {
  return runWhy({}, ['left-pad'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect(report[report.length - 1].data).toEqual(reporter.lang('whySpecifiedSimple', 'devDependencies'));
  });
});

test.concurrent('should determine that the module installed because mime-types depend on it', (): Promise<void> => {
  return runWhy({}, ['mime-db'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect(report[report.length - 1].data).toEqual(reporter.lang('whyDependedOnSimple', 'mime-types'));
  });
});

test.concurrent('should determine that the module installed because it is hoisted from glob depend on it', (): Promise<
  void,
> => {
  return runWhy({}, ['glob#minimatch'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect(report[report.length - 2].data).toEqual(reporter.lang('whyHoistedTo', 'glob#minimatch'));
  });
});
