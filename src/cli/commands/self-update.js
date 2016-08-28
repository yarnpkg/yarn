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
import {USER_AGENT} from '../../constants.js';
import {GITHUB_REPO} from '../../constants.js';
import {GITHUB_USER} from '../../constants.js';
import {SELF_UPDATE_DOWNLOAD_FOLDER} from '../../constants.js';
import TarballFetcher from '../../fetchers/TarballFetcher.js';
import {symlink} from '../../util/fs.js';
import {unlink} from '../../util/fs.js';

const path = require('path');
const GitHubApi = require('github');

export function setFlags(commander: Object) {
  // token needed because it is a private repo now
  commander.option('--github-auth0-token <value>', 'Auth0 token to download a kpm .tar.gz release');
  commander.arguments('[tag]', 'e.g. v0.10.0');
}

export const noArguments = false;
export const requireLockfile = false;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const github = new GitHubApi({
    debug: false,
    protocol: 'https',
    host: 'api.github.com',
    headers: {
      'user-agent': USER_AGENT,
    },
    Promise,
    followRedirects: false,
    timeout: 5000,
  });

  github.authenticate({
    type: 'oauth',
    token: flags.githubAuth0Token,
  });

  let release;
  const gitTag = args[0];
  if (gitTag) {
    release = await
    github.repos.getReleaseByTag({
      user: GITHUB_USER,
      repo: GITHUB_REPO,
      tag: gitTag,
    });
  } else {
    release = await
    github.repos.getLatestRelease({
      user: GITHUB_USER,
      repo: GITHUB_REPO,
    });
  }
  const assets = await github.repos.listAssets({
    user: GITHUB_USER,
    repo: GITHUB_REPO,
    id: release.id,
  });

  reporter.info(`Downloading asset ${assets[0].name} from release ${release.tag_name}`);

  const updatesFolder = path.resolve(__dirname, '..', '..', '..', SELF_UPDATE_DOWNLOAD_FOLDER);
  const locToUnzip = path.resolve(updatesFolder, release.tag_name);

  await unlink(locToUnzip);

  const fetcher = new TarballFetcher({
    type: 'tarball',
    registry: 'npm',
    reference: `${assets[0].url}?access_token=${flags.githubAuth0Token}`,
    hash: null,
  }, config, false);
  await fetcher.fetch(locToUnzip);

  // now the downloaded release is used in bin/kpm.js
  await symlink(locToUnzip, `${updatesFolder}/current`);
  // symlink updates folder of the downloaed release to the top
  await symlink(`${updatesFolder}`, `${locToUnzip}/updates`);
  // remove previous installation if there was one
  await unlink(`${updatesFolder}/previous`);
  // this will be deleted during next update
  // TODO mark current folder as previous
  // await symlink(locToUnzip, `${updatesFolder}/previous`);

  reporter.info(`Replaced current release with ${release.tag_name}`);
}
