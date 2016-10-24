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
  if (cmd && isValidCommand(commandName, cmd)) {
    await execCommand(commandName, config, cmd, cwd);
  }
}

function isValidCommand(commandName: string, cmd: string): boolean {
  // prevent infinite loop (see: https://github.com/yarnpkg/yarn/issues/1227)
  // blocks `yarn`, `yarn i`, `yarn install`, with any flags as well
  if (commandName.endsWith('install') && /^yarn(\si(nstall)?)?(\s\-.*)?$/.test(cmd)) {
    return false;
  }

  return true;
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
