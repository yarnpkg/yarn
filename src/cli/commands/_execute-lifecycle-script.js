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

import type Config from '../../config.js';
import {SpawnError} from '../../errors.js';
import executeLifecycleScript from '../../util/execute-lifecycle-script.js';

export default async function (config: Config, commandName: string): Promise<void> {
  const pkg = await config.readManifest(config.cwd);
  await execFromManifest(config, commandName, pkg, config.cwd);
}

export async function execFromManifest(config: Config, commandName: string, pkg: Object, cwd: string): Promise<void> {
  if (!pkg.scripts) {
    return;
  }

  const cmd = pkg.scripts[commandName];
  if (cmd) {
    await execCommand(config, cmd, cwd);
  }
}

export async function execCommand(config: Config, cmd: string, cwd: string): Promise<void> {
  let {reporter} = config;
  try {
    reporter.command(cmd);
    await executeLifecycleScript(config, cwd, cmd);
    return Promise.resolve();
  } catch (err) {
    if (err instanceof SpawnError) {
      reporter.error(reporter.lang('commandFailed', err.EXIT_CODE));
      return Promise.reject();
    } else {
      throw err;
    }
  }
}
