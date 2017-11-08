// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import buildSubCommands from './_build-sub-commands.js';

const invariant = require('invariant');
const path = require('path');

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function info(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const {workspaceRootFolder} = config;

  if (!workspaceRootFolder) {
    throw new MessageError(reporter.lang('workspaceRootNotFound', config.cwd));
  }

  const manifest = await config.findManifest(workspaceRootFolder, false);
  invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

  const workspaces = await config.resolveWorkspaces(workspaceRootFolder, manifest);

  const publicData = {};

  for (const workspaceName of Object.keys(workspaces)) {
    publicData[workspaceName] = {
      location: path.relative(config.lockfileFolder, workspaces[workspaceName].loc),
    };
  }

  reporter.log(JSON.stringify(publicData, null, 2), {force: true});
}

const {run, setFlags, examples} = buildSubCommands('workspaces', {
  async info(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await info(config, reporter, flags, args);
  },
});

export {run, setFlags, examples};
