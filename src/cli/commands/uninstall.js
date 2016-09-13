/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {execFromManifest} from './_execute-lifecycle-script.js';
import Lockfile from '../../lockfile/wrapper.js';
import {registries} from '../../registries/index.js';
import {Install} from './install.js';
import {MessageError} from '../../errors.js';
import {NoopReporter} from '../../reporters/index.js';
import * as fs from '../../util/fs.js';

const path = require('path');

export const requireLockfile = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  if (!args.length) {
    throw new MessageError(reporter.lang('tooFewArguments', 1));
  }

  const totalSteps = args.length + 1;
  let step = 0;

  // load manifests
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install(flags, config, new NoopReporter(), lockfile);
  const jsons = await install.getRootManifests();
  const manifests = [];

  for (const name of args) {
    reporter.step(++step, totalSteps, `Removing module ${name}`);

    let found = false;

    for (const registryName of Object.keys(registries)) {
      const registry = config.registries[registryName];
      let json = jsons[registryName][1];

      for (const type of ['devDependencies', 'dependencies', 'optionalDependencies', 'peerDependencies']) {
        const deps = json[type];
        if (deps) {
          found = true;
          delete deps[name];
        }
      }

      const possibleManifestLoc = path.join(config.cwd, registry.folder, name);
      if (await fs.exists(possibleManifestLoc)) {
        manifests.push([
          possibleManifestLoc,
          await config.readManifest(possibleManifestLoc, registryName),
        ]);
      }
    }

    if (!found) {
      throw new MessageError(reporter.lang('moduleNotInManifest'));
    }
  }

  // save manifests
  await install.saveRootManifests(jsons);

  // run hooks - npm runs these one after another
  for (let action of ['preuninstall', 'uninstall', 'postuninstall']) {
    for (const [loc, manifest] of manifests) {
      await execFromManifest(config, action, manifest, loc);
    }
  }

  // reinstall so we can get the updated lockfile
  reporter.step(++step, totalSteps, reporter.lang('uninstallRegenerate'));
  const reinstall = new Install({force: true, ...flags}, config, new NoopReporter(), lockfile);
  await reinstall.init();

  //
  reporter.success(reporter.lang('uninstalledPackages'));
}
