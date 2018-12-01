/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import Lockfile from '../../lockfile';
import {registries} from '../../registries/index.js';
import {Install} from './install.js';
import {MessageError} from '../../errors.js';
import {NoopReporter} from '../../reporters/index.js';
import * as fs from '../../util/fs.js';
import * as constants from '../../constants.js';

const path = require('path');
const emoji = require('node-emoji');

export const requireLockfile = true;

export function setFlags(commander: Object) {
  commander.description('Removes a package from your direct dependencies updating your package.json and yarn.lock.');
  commander.usage('remove [packages ...] [flags]');
  commander.option('-W, --ignore-workspace-root-check', 'required to run yarn remove inside a workspace root');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const isWorkspaceRoot = config.workspaceRootFolder && config.cwd === config.workspaceRootFolder;

  if (!args.length) {
    throw new MessageError(reporter.lang('tooFewArguments', 1));
  }

  // running "yarn remove something" in a workspace root is often a mistake
  if (isWorkspaceRoot && !flags.ignoreWorkspaceRootCheck) {
    throw new MessageError(reporter.lang('workspacesRemoveRootCheck'));
  }

  const totalSteps = args.length + 1;
  let step = 0;

  // load manifests
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder);
  const rootManifests = await config.getRootManifests();
  const manifests = [];

  for (const name of args) {
    reporter.step(++step, totalSteps, `Removing module ${name}`, emoji.get('wastebasket'));

    let found = false;

    for (const registryName of Object.keys(registries)) {
      const registry = config.registries[registryName];
      const object = rootManifests[registryName].object;

      for (const type of constants.DEPENDENCY_TYPES) {
        const deps = object[type];
        if (deps && deps[name]) {
          found = true;
          delete deps[name];
        }
      }

      const possibleManifestLoc = path.join(config.cwd, registry.folder, name);
      if (await fs.exists(possibleManifestLoc)) {
        const manifest = await config.maybeReadManifest(possibleManifestLoc, registryName);
        if (manifest) {
          manifests.push([possibleManifestLoc, manifest]);
        }
      }
    }

    if (!found) {
      throw new MessageError(reporter.lang('moduleNotInManifest'));
    }
  }

  // save manifests
  await config.saveRootManifests(rootManifests);

  // run hooks - npm runs these one after another
  for (const action of ['preuninstall', 'uninstall', 'postuninstall']) {
    for (const [loc] of manifests) {
      await config.executeLifecycleScript(action, loc);
    }
  }

  // reinstall so we can get the updated lockfile
  reporter.step(++step, totalSteps, reporter.lang('uninstallRegenerate'), emoji.get('hammer'));
  const installFlags = {force: true, workspaceRootIsCwd: true, ...flags};
  const reinstall = new Install(installFlags, config, new NoopReporter(), lockfile);
  await reinstall.init();

  //
  reporter.success(reporter.lang('uninstalledPackages'));
}
