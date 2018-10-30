/* @flow */

import * as constants from '../../constants.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import * as fs from '../../util/fs.js';
import {version as YARN_VERSION} from '../../util/yarn-version.js';
const os = require('os');
const path = require('path');
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
  const showPackageAndLockfile: boolean = await reporter.questionAffirm(
    'Do you want to add your package.json / yarn.lock to the report? [n/Y]',
  );
  reporter.log(reporter.lang('supportInfoHeader', latestVersion, YARN_VERSION));
  reporter.log(
    reporter.lang(
      'supportInfo',
      reporter.rawText(YARN_VERSION),
      reporter.rawText(nodeVersion),
      reporter.rawText(osName(osPlatform, osRelease)),
    ),
  );
  if (showPackageAndLockfile) {
    const pkg = await fs.readFile(path.join(config.cwd, 'package.json'));
    reporter.log(reporter.lang('supportInfoPackageJson', reporter.rawText(pkg)));

    const yarnLock = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    reporter.log(reporter.lang('supportInfoYarnLock', reporter.rawText(yarnLock)));
  }
}
