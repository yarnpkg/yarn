/* @flow */

import {run} from '../../src/cli/commands/run.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'run');

jest.mock('../../src/util/execute-lifecycle-script');
const executeLifecycleScript = (require('../../src/util/execute-lifecycle-script').default: $FlowFixMe);

async function runRun(
  flags: Object,
  args: Array<string>,
  name: string,
): Promise<Config> {
  const cwd = path.join(fixturesLoc, name);
  const reporter = new reporters.NoopReporter();
  const config = new Config(reporter);
  await config.init({cwd});
  await run(config, reporter, flags, args);
  return config;
}

beforeEach(() => {
  executeLifecycleScript.mockClear();
});

it('run should run script', async (): Promise<void> => {
  const config = await runRun({}, ['some-script'], 'run-should-run-script');

  const expectedCall = [
    'some-script',
    config,
    config.cwd,
    `echo success `,
  ];

  expect(executeLifecycleScript.mock.calls.length).toEqual(1);
  expect(executeLifecycleScript).toBeCalledWith(...expectedCall);
});

it('run should run binary', async (): Promise<void> => {
  const config = await runRun({}, ['some-binary'], 'run-should-run-binary');

  const expectedCall = [
    'some-binary',
    config,
    config.cwd,
    `"${path.join(config.cwd, 'node_modules/.bin/some-binary')}" `,
  ];

  expect(executeLifecycleScript.mock.calls.length).toEqual(1);
  expect(executeLifecycleScript).toBeCalledWith(...expectedCall);
});

it('run should run binary with args', async (): Promise<void> => {
  const config = await runRun({}, ['some-binary', '--test-arg'], 'run-should-run-binary-with-args');

  const expectedCall = [
    'some-binary',
    config,
    config.cwd,
    `"${path.join(config.cwd, 'node_modules/.bin/some-binary')}" --test-arg`,
  ];

  expect(executeLifecycleScript.mock.calls.length).toEqual(1);
  expect(executeLifecycleScript).toBeCalledWith(...expectedCall);
});

it('run should run binary with space in path', async (): Promise<void> => {
  const config = await runRun({}, ['some-binary'], 'run should run binary with space in path');

  const expectedCall = [
    'some-binary',
    config,
    config.cwd,
    `"${path.join(config.cwd, 'node_modules/.bin/some-binary')}" `,
  ];

  expect(executeLifecycleScript.mock.calls.length).toEqual(1);
  expect(executeLifecycleScript).toBeCalledWith(...expectedCall);
});
