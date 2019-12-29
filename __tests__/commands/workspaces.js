// @flow
jest.mock('../../src/util/child');

import {BufferReporter} from '../../src/reporters/index.js';
import {run as workspace} from '../../src/cli/commands/workspaces.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';
import {NODE_BIN_PATH, YARN_BIN_PATH} from '../../src/constants';

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'workspace');
const spawn: $FlowFixMe = require('../../src/util/child').spawn;

beforeEach(() => spawn.mockClear());

async function runWorkspaces(
  flags: Object,
  args: Array<string>,
  name: string,
  checkSteps?: ?(config: Config, reporter: BufferReporter) => ?Promise<void>,
): Promise<void> {
  const cwd = path.join(fixturesLoc, name);
  const reporter = new reporters.BufferReporter({stdout: null, stdin: null, isSilent: true});

  const config = await Config.create({cwd}, reporter);

  await workspace(config, reporter, flags, args);

  if (checkSteps) {
    await checkSteps(config, reporter);
  }
}

test('workspaces info should list the workspaces', (): Promise<void> => {
  return runWorkspaces({}, ['info'], 'run-basic', (config, reporter) => {
    expect(reporter.getBufferJson()).toEqual({
      'workspace-1': {
        location: 'packages/workspace-child-1',
        workspaceDependencies: [],
        mismatchedWorkspaceDependencies: [],
      },
      'workspace-2': {
        location: 'packages/workspace-child-2',
        workspaceDependencies: ['workspace-1'],
        mismatchedWorkspaceDependencies: [],
      },
    });
  });
});

test('workspaces run should spawn command for each workspace', (): Promise<void> => {
  return runWorkspaces({}, ['run', 'script', 'arg1', '--flag1'], 'run-basic', config => {
    expect(spawn).toHaveBeenCalledWith(NODE_BIN_PATH, [YARN_BIN_PATH, 'run', 'script', 'arg1', '--flag1'], {
      stdio: 'inherit',
      cwd: path.join(fixturesLoc, 'run-basic', 'packages', 'workspace-child-1'),
    });
    expect(spawn).toHaveBeenCalledWith(NODE_BIN_PATH, [YARN_BIN_PATH, 'run', 'script', 'arg1', '--flag1'], {
      stdio: 'inherit',
      cwd: path.join(fixturesLoc, 'run-basic', 'packages', 'workspace-child-2'),
    });
  });
});
