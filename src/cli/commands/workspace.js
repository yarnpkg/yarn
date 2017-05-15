// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import * as filter from '../../util/filter.js';

export function setFlags() {}

export function hasWrapper(): boolean {
  return true;
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const projectPath = await config.findProject(config.cwd);

  if (!projectPath) {
    throw new MessageError(reporter.lang('projectRootNotFound', config.cwd));
  }

  const manifest = await config.findManifest(projectPath);
  const workspaces = await config.resolveWorkspaces(projectPath, manifest.workspaces);

  if (args.length < 1) {
    throw new MessageError(reporter.lang('projectMissingWorkspace'));
  }

  if (args.length < 2) {
    throw new MessageError(reporter.lang('projectMissingCommand'));
  }

  const [workspaceName, ... rest] = args;

  if (!Object.prototype.hasOwnProperty.call(workspaces, workspaceName)) {
    throw new MessageError(reporter.lang('projectUnknownWorkspace', workspaceName));
  }

  try {
    await child.spawn(process.argv[0], [process.argv[1], ... rest], { stdio: 'inherit' });
  } catch (err) {
  }
}
