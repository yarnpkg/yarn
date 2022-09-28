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
const clipboardy = require('clipboardy');

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

  let output = '';

  reporter.log(reporter.lang('supportInfoHeader', latestVersion, YARN_VERSION));

  const versionDetails = reporter.lang(
    'supportInfo',
    reporter.rawText(YARN_VERSION),
    reporter.rawText(nodeVersion),
    reporter.rawText(osName(osPlatform, osRelease)),
  );

  output += versionDetails + '\n';
  reporter.log(versionDetails);

  const pkgJsonPath = `${config.lockfileFolder}/package.json`;
  if (await fs.exists(pkgJsonPath)) {
    const pkgJson = await fs.readFile(pkgJsonPath);
    output += '\n<details><summary><b>package.json</b></summary>\n\n```json\n' + pkgJson + '\n```\n\n</details>\n';
  }

  const yarnLockPath = `${config.lockfileFolder}/yarn.lock`;
  if (await fs.exists(yarnLockPath)) {
    const yarnLock = await fs.readFile(yarnLockPath);
    output += '\n<details><summary><b>yarn.lock</b></summary>\n\n```\n' + yarnLock + '\n```\n\n</details>\n';
  }

  clipboardy.writeSync(output);

  reporter.log('');
  reporter.log(reporter.lang('supportInfoCopied'));
}
