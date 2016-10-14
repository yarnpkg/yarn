/* @flow */

import type Config from '../../config.js';
import {SpawnError, MessageError} from '../../errors.js';
import executeLifecycleScript from '../../util/execute-lifecycle-script.js';

export default async function (config: Config, commandName: string): Promise<void> {
  const pkg = await config.readManifest(config.cwd);
  await execFromManifest(config, commandName, pkg, config.cwd);
}

export async function execFromManifest(config: Config, commandName: string, pkg: Object, cwd: string): Promise<void> {
  if (!pkg.scripts) {
    return;
  }

  const cmd: ?string = pkg.scripts[commandName];
  if (cmd) {
    await execCommand(commandName, config, cmd, cwd);
  }
}

export async function execCommand(stage: string, config: Config, cmd: string, cwd: string): Promise<void> {
  const {reporter} = config;
  try {
    reporter.command(cmd);
    await executeLifecycleScript(stage, config, cwd, cmd);
    return Promise.resolve();
  } catch (err) {
    if (err instanceof SpawnError) {
      throw new MessageError(reporter.lang('commandFailed', err.EXIT_CODE));
    } else {
      throw err;
    }
  }
}
