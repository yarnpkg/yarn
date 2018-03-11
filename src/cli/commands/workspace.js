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

// Due to the way flags are included from .yarnrc, the params can end up out of order.
// Workspace expects [package_name, command, --emoji, false, ...etc] but when included from .yarnrc
// flags end up at the beginning [--emoji, false, package_name, command]
// This function moves all the plain words (commands) to the beginning, followed by all flags.
// See: https://github.com/yarnpkg/yarn/issues/5496
function reorderArgs(commander: Object, rawArgs: Array<string>): Array<string> {
  const args = [...rawArgs];
  const flags = [];
  const commands = [];

  while (args.length) {
    const opt = commander.optionFor(args[0]);
    if (opt) {
      flags.push(args.shift());

      if (opt.required) {
        flags.push(args.shift());
      } else if (opt.optional && opt.bool && (args.length && typeof args[0] === 'boolean')) {
        flags.push(args.shift());
      }
    } else {
      commands.push(args.shift());
    }
  }
  return [...commands, ...flags];
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
  // rawArgs contains: [nodePath, yarnPath, 'workspace', ...]
  const [, , , ...rest] = flags.rawArgs || [];
  const reordered = reorderArgs(flags, rest);
  const workspaceName = reordered.shift();

  if (!Object.prototype.hasOwnProperty.call(workspaces, workspaceName)) {
    throw new MessageError(reporter.lang('workspaceUnknownWorkspace', workspaceName));
  }

  const workspace = workspaces[workspaceName];

  try {
    await child.spawn(NODE_BIN_PATH, [YARN_BIN_PATH, ...reordered], {
      stdio: 'inherit',
      cwd: workspace.loc,
    });
  } catch (err) {
    throw err;
  }
}
