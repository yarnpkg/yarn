/* @flow */

jest.mock('../../src/util/child');

import {BufferReporter} from '../../src/reporters/index.js';
import {run as workspace} from '../../src/cli/commands/workspace.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';
import {NODE_BIN_PATH, YARN_BIN_PATH} from '../../src/constants';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'workspace');
const spawn: $FlowFixMe = require('../../src/util/child').spawn;

beforeEach(() => spawn.mockClear());

async function runWorkspace(
  flags: Object,
  args: Array<string>,
  name: string,
  checkSteps?: ?(config: Config, reporter: BufferReporter) => ?Promise<void>,
): Promise<void> {
  const cwd = path.join(fixturesLoc, name);
  const reporter = new reporters.BufferReporter({stdout: null, stdin: null});

  try {
    const config = await Config.create({cwd}, reporter);

    await workspace(config, reporter, flags, args);

    if (checkSteps) {
      await checkSteps(config, reporter);
    }
  } catch (err) {
    throw new Error(`${err && err.stack}`);
  }
}

test('workspace run command', (): Promise<void> => {
  return runWorkspace({}, ['workspace-1', 'run', 'script'], 'run-basic', config => {
    expect(spawn).toHaveBeenCalledWith(NODE_BIN_PATH, [YARN_BIN_PATH, 'run', 'script'], {
      stdio: 'inherit',
      cwd: path.join(fixturesLoc, 'run-basic', 'packages', 'workspace-child-1'),
    });
  });
});
