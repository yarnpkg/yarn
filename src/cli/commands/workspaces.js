// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import buildSubCommands from './_build-sub-commands.js';
import {DEPENDENCY_TYPES} from '../../constants.js';

const invariant = require('invariant');
const path = require('path');
const semver = require('semver');

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
    const {loc, manifest} = workspaces[workspaceName];

    const workspaceDependencies = new Set();
    const mismatchedWorkspaceDependencies = new Set();

    for (const dependencyType of DEPENDENCY_TYPES) {
      if (dependencyType !== 'peerDependencies') {
        for (const dependencyName of Object.keys(manifest[dependencyType] || {})) {
          if (Object.prototype.hasOwnProperty.call(workspaces, dependencyName)) {
            invariant(manifest && manifest[dependencyType], 'The request should exist');
            const requestedRange = manifest[dependencyType][dependencyName];
            if (semver.satisfies(workspaces[dependencyName].manifest.version, requestedRange)) {
              workspaceDependencies.add(dependencyName);
            } else {
              mismatchedWorkspaceDependencies.add(dependencyName);
            }
          }
        }
      }
    }

    publicData[workspaceName] = {
      location: path.relative(config.lockfileFolder, loc).replace(/\\/g, '/'),
      workspaceDependencies: Array.from(workspaceDependencies),
      mismatchedWorkspaceDependencies: Array.from(mismatchedWorkspaceDependencies),
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
