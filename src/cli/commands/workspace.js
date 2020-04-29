// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import {NODE_BIN_PATH, YARN_BIN_PATH} from '../../constants';

const invariant = require('invariant');

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const {workspaceRootFolder} = config;

  if (!workspaceRootFolder) {
    throw new MessageError(reporter.lang('workspaceRootNotFound', config.cwd));
  }

  if (args.length < 1) {
    throw new MessageError(reporter.lang('workspaceMissingWorkspace'));
  }

  if (args.length < 2) {
    throw new MessageError(reporter.lang('workspaceMissingCommand'));
  }

  const manifest = await config.findManifest(workspaceRootFolder, false);
  invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

  const workspaces = await config.resolveWorkspaces(workspaceRootFolder, manifest);
  const [workspaceName, ...rest] = args || [];

  if (!Object.prototype.hasOwnProperty.call(workspaces, workspaceName)) {
    throw new MessageError(reporter.lang('workspaceUnknownWorkspace', workspaceName));
  }

  const workspace = workspaces[workspaceName];

  try {
    await child.spawn(NODE_BIN_PATH, [YARN_BIN_PATH, ...rest], {
      stdio: 'inherit',
      cwd: workspace.loc,
    });
  } catch (err) {
    throw err;
  }
}
