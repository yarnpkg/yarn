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
import type {RegistryNames} from '../../registries/index.js';
import Lockfile from '../../lockfile/Lockfile.js';
import {registries} from '../../registries/index.js';
import {Install} from './install.js';
import {MessageError} from '../../errors.js';
import {stringify} from '../../util/misc.js';
import {NoopReporter} from '../../reporters/index.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
const path = require('path');

export const requireLockfile = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  if (!args.length) {
    throw new MessageError('Expected one or more arguments');
  }

  const totalSteps = args.length + 1;
  let step = 0;

  async function runInstall(): Promise<Install> {
    const lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
      silent: true,
    });
    const install = new Install('uninstall', flags, [], config, new NoopReporter(), lockfile);
    await install.init();
    return install;
  }

  // load manifests
  let jsons: {
    [loc: string]: [RegistryNames, Object]
  } = {};
  for (let registryName of Object.keys(registries)) {
    const registry = registries[registryName];
    const jsonLoc = path.join(config.cwd, registry.filename);
    if (await fs.exists(jsonLoc)) {
      jsons[jsonLoc] = [registryName, await fs.readJson(jsonLoc)];
    }
  }

  for (const name of args) {
    reporter.step(++step, totalSteps, `Removing module ${name}`);

    let found = false;
    let folder;

    for (let loc in jsons) {
      let [registryName, json] = jsons[loc];

      for (const type of ['devDependencies', 'dependencies', 'optionalDependencies', 'peerDependencies']) {
        const deps = json[type];
        if (deps) {
          found = true;
          folder = config.registries[registryName].folder;
          delete deps[name];
        }
      }
    }

    if (!found) {
      throw new MessageError("This module isn't specified in a manifest");
    }

    invariant(folder, 'expected folder');

    // remove bins
    const loc = path.join(config.cwd, folder, name);
    const pkg = await config.readManifest(loc);
    for (const binName in pkg.bin) {
      await fs.unlink(path.join(config.modulesFolder, folder, '.bin', binName));
    }
  }

  // save manifests
  for (let loc in jsons) {
    await fs.writeFile(loc, stringify(jsons[loc][1]) + '\n');
  }

  // reinstall so we can get the updated lockfile
  reporter.step(++step, totalSteps, 'Regenerating lockfile and installing missing dependencies');
  await runInstall();

  //
  reporter.success('Successfully uninstalled packages.');
}
