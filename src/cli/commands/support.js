/* @flow */

import * as constants from '../../constants.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {version as YARN_VERSION} from '../../util/yarn-version.js';
const os = require('os');
import osName from 'os-name';
const semver = require('semver');

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return false;
}

export function setFlags(commander: Object) {
  commander.description('Displays system information useful in issues.');
}

export async function run(config: Config, reporter: Reporter, commander: Object, args: Array<string>): Promise<void> {
  const latestVersion = await config.requestManager.request({
    url: constants.SELF_UPDATE_VERSION_URL,
  });
  const nodeVersion = process.versions.node.split('-')[0];
  const osPlatform = os.platform();
  const osRelease = os.release();
  if (semver.gt(latestVersion, YARN_VERSION)) {
    reporter.warn(reporter.lang('supportYarnOutdated', latestVersion, YARN_VERSION));
  }
  reporter.log(
    reporter.lang(
      'supportInfo',
      reporter.rawText(YARN_VERSION),
      reporter.rawText(nodeVersion),
      reporter.rawText(osName(osPlatform, osRelease)),
    ),
  );
}
