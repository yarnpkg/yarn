/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import Lockfile from '../../lockfile/wrapper.js';
import {registries} from '../../registries/index.js';
import {Install} from './install.js';
import {MessageError} from '../../errors.js';
import {NoopReporter} from '../../reporters/index.js';
import * as fs from '../../util/fs.js';
import * as constants from '../../constants.js';

const path = require('path');

export const requireLockfile = true;

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (!args.length) {
    throw new MessageError(reporter.lang('tooFewArguments', 1));
  }

  const totalSteps = args.length + 1;
  let step = 0;

  // load manifests
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const rootManifests = await config.getRootManifests();
  const manifests = [];

  for (const name of args) {
    reporter.step(++step, totalSteps, `Removing module ${name}`);

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
        manifests.push([possibleManifestLoc, await config.readManifest(possibleManifestLoc, registryName)]);
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
  reporter.step(++step, totalSteps, reporter.lang('uninstallRegenerate'));
  const reinstall = new Install({force: true, ...flags}, config, new NoopReporter(), lockfile);
  await reinstall.init();

  //
  reporter.success(reporter.lang('uninstalledPackages'));
}
