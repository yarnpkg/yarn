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
import GenericTarballFetcher from '../../util/GenericTarballFetcher.js';
import {symlink} from '../../util/fs.js';
import {unlink} from '../../util/fs.js';

const path = require('path');
const GitHubApi = require('github');

export function setFlags(commander: Object) {
  // token needed because it is a private repo now
  commander.option('--github-auth0-token <value>', 'Auth0 token to download a kpm .tar.gz release');
  commander.option('--git-tag [value]', 'e.g. v0.10.0');
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
    Promise: Promise,
    followRedirects: false,
    timeout: 5000
  });

  github.authenticate({
    type: 'oauth',
    token: flags.githubAuth0Token,
  });

  let release;
  if (!flags.gitTag) {
    release = await github.repos.getLatestRelease({
      user: GITHUB_USER,
      repo: GITHUB_REPO,
    });
  } else {
    release = await github.repos.getReleaseByTag({
      user: GITHUB_USER,
      repo: GITHUB_REPO,
      tag: flags.gitTag,
    });
  }
  const assets = await github.repos.listAssets({
    user: GITHUB_USER,
    repo: GITHUB_REPO,
    id: release.id
  });

  reporter.info(`Downloading asset ${assets[0].name} from release ${release.tag_name}`);

  const updatesFolder = path.resolve(__dirname, '..', '..', '..', SELF_UPDATE_DOWNLOAD_FOLDER);
  const locToUnzip = path.resolve(updatesFolder, release.tag_name);

  await unlink(locToUnzip);

  const fetcher = new GenericTarballFetcher();
  await fetcher.fetch(`${assets[0].url}?access_token=${flags.githubAuth0Token}`, locToUnzip);

  await symlink(locToUnzip, `${updatesFolder}/current`);

  reporter.info(`Replaced current release with ${release.tag_name}`);
}
