// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';

const invariant = require('invariant');

export function setFlags() {}

export function hasWrapper(): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const {worktreeFolder} = config;

  if (!worktreeFolder) {
    throw new MessageError(reporter.lang('worktreeRootNotFound', config.cwd));
  }

  if (args.length < 1) {
    throw new MessageError(reporter.lang('worktreeMissingWorkspace'));
  }

  if (args.length < 2) {
    throw new MessageError(reporter.lang('worktreeMissingCommand'));
  }

  const manifest = await config.findManifest(worktreeFolder, false);
  invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

  const workspaces = await config.resolveWorkspaces(worktreeFolder, manifest.workspaces);

  const [workspaceName, ...rest] = args;

  if (!Object.prototype.hasOwnProperty.call(workspaces, workspaceName)) {
    throw new MessageError(reporter.lang('worktreeUnknownWorkspace', workspaceName));
  }

  try {
    await child.spawn(process.argv[0], [process.argv[1], ...rest], {stdio: 'inherit'});
  } catch (err) {
    throw err;
  }
}
