/* @flow */

import semver from 'semver';
import type Config from '../../config.js';
import {SELF_UPDATE_VERSION_URL} from '../../constants.js';
import type {Reporter} from '../../reporters/index.js';
import {getInstallationMethod} from '../../util/yarn-version.js';
import {getUpdateCommand} from './install';
import {execCommand} from '../../util/execute-lifecycle-script.js';

export const noArguments = true;
export const requireLockfile = false;

export function setFlags(commander: Object) {
  commander.description('Updates yarn according to the installation method');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const currentVersion = flags.version();
  const latestVersion = await config.requestManager.request({
    url: SELF_UPDATE_VERSION_URL,
    headers: {
      Accept: 'text/plain',
    },
  });

  // Check if we already use the latest or a newer version
  if (semver.compare(currentVersion, latestVersion) >= 0) {
    reporter.info('already on latest version or higher');
    return;
  }

  const installationMethod = await getInstallationMethod();

  reporter.info(installationMethod);

  if (installationMethod === 'unknown') {
    reporter.info('installation method could not be identified');
    return;
  }

  const command = getUpdateCommand(installationMethod);
  if (command) {
    reporter.info(`installation method: , ${installationMethod}`);

    reporter.info('running');

    await execCommand({
      // Could not figure out to which stage should this belong to.
      stage: 'self-update',
      config,
      cmd: command,
      cwd: config.cwd,
      isInteractive: true,
    });
  } else {
    reporter.info('could not find command for instalation method');
  }
}
