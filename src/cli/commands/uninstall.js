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
import Lockfile from '../../lockfile/wrapper.js';
import {registries} from '../../registries/index.js';
import {Install} from './install.js';
import {MessageError} from '../../errors.js';
import {stringify} from '../../util/misc.js';
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
  let jsons: {
    [loc: string]: Object
  } = {};
  for (let registryName of Object.keys(registries)) {
    const registry = registries[registryName];
    const jsonLoc = path.join(config.cwd, registry.filename);
    if (await fs.exists(jsonLoc)) {
      jsons[jsonLoc] = await fs.readJson(jsonLoc);
    }
  }

  for (const name of args) {
    reporter.step(++step, totalSteps, `Removing module ${name}`);

    let found = false;

    for (let loc in jsons) {
      let json = jsons[loc];

      for (const type of ['devDependencies', 'dependencies', 'optionalDependencies', 'peerDependencies']) {
        const deps = json[type];
        if (deps) {
          found = true;
          delete deps[name];
        }
      }
    }

    if (!found) {
      throw new MessageError(reporter.lang('moduleNotInManifest'));
    }
  }

  // save manifests
  for (let loc in jsons) {
    await fs.writeFile(loc, stringify(jsons[loc]) + '\n');
  }

  // reinstall so we can get the updated lockfile
  reporter.step(++step, totalSteps, reporter.lang('uninstallRegenerate'));
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install({force: true, ...flags}, config, new NoopReporter(), lockfile);
  await install.init();

  //
  reporter.success(reporter.lang('uninstalledPackages'));
}
