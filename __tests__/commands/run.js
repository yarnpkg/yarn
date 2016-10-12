/* @flow */

import {run} from '../../src/cli/commands/run.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'run');

async function runRun(
  flags: Object,
  args: Array<string>,
  name: string,
): Promise<void> {
  const cwd = path.join(fixturesLoc, name);
  const reporter = new reporters.NoopReporter();
  const config = new Config(reporter);
  await config.init({cwd});
  return run(config, reporter, flags, args);
}

test.concurrent('run should run script', (): Promise<void> => {
  return runRun({}, ['some-script'], 'run-should-run-script');
});

test.concurrent('run should run binary', (): Promise<void> => {
  return runRun({}, ['echo'], 'run-should-run-binary');
});

test.concurrent('run should run binary with args', (): Promise<void> => {
  return runRun({}, ['echo', '--test-arg'], 'run-should-run-binary-with-args');
});

test.concurrent('run should run binary with space in path', (): Promise<void> => {
  return runRun({}, ['echo'], 'run should run binary with space in path');
});
