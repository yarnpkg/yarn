// @flow

import {BufferReporter} from '../../src/reporters/index.js';
import {run as workspace} from '../../src/cli/commands/workspaces.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'workspace');

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
      'nested-workspace-1': {
        location: 'packages/nested-workspace/packages/nested-workspace-child-1',
        workspaceDependencies: ['workspace-1'],
        mismatchedWorkspaceDependencies: [],
      },
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

test('workspaces info for nested workspace should list the global workspaces', (): Promise<void> => {
  const name = path.join('run-basic', 'packages', 'nested-workspace', 'packages', 'nested-workspace-child-1');
  return runWorkspaces({}, ['info'], name, (config, reporter) => {
    expect(reporter.getBufferJson()).toEqual({
      'nested-workspace-1': {
        location: 'packages/nested-workspace/packages/nested-workspace-child-1',
        workspaceDependencies: ['workspace-1'],
        mismatchedWorkspaceDependencies: [],
      },
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

test('workspaces info should list the local workspaces if nested is unspecified in the global', (): Promise<void> => {
  const name = path.join('run-basic', 'packages', 'nested-workspace', 'packages', 'nested-workspace-child-2');
  return runWorkspaces({}, ['info'], name, (config, reporter) => {
    expect(reporter.getBufferJson()).toEqual({
      'nested-workspace-1': {
        location: 'packages/nested-workspace-child-1',
        workspaceDependencies: [],
        mismatchedWorkspaceDependencies: [],
      },
      'nested-workspace-2': {
        location: 'packages/nested-workspace-child-2',
        workspaceDependencies: [],
        mismatchedWorkspaceDependencies: [],
      },
    });
  });
});
