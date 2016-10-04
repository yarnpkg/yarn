/* @flow */

import type Config from '../../config.js';
import {GITHUB_REPO, GITHUB_USER, SELF_UPDATE_DOWNLOAD_FOLDER, USER_AGENT} from '../../constants.js';
import TarballFetcher from '../../fetchers/tarball-fetcher.js';
import type {Reporter} from '../../reporters/index.js';
import {exists, realpath, symlink, unlink} from '../../util/fs.js';

const path = require('path');
const GitHubApi = require('github');

export function setFlags(commander: Object) {
  // token needed because it is a private repo now
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
      'User-Agent': USER_AGENT,
    },
    Promise,
    followRedirects: false,
    timeout: 5000,
  });

  // while yarn is close sourced we need an auth token to be passed
  const githubAuth0Token = process.env.YARN_AUTH_TOKEN || process.env.KPM_AUTH_TOKEN;
  github.authenticate({
    type: 'oauth',
    token: githubAuth0Token,
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

  reporter.info(reporter.lang('selfUpdateDownloading', assets[0].name, release.tag_name));

  const thisVersionRoot = path.resolve(__dirname, '..', '..', '..');
  const isCurrentVersionAnUpdate =
    path.basename(path.resolve(thisVersionRoot, '..')) === SELF_UPDATE_DOWNLOAD_FOLDER;
  let updatesFolder;
  if (isCurrentVersionAnUpdate) {
    updatesFolder = path.resolve(thisVersionRoot, '..');
  } else {
    updatesFolder = path.resolve(thisVersionRoot, SELF_UPDATE_DOWNLOAD_FOLDER);
  }

  const locToUnzip = path.resolve(updatesFolder, release.tag_name);

  await unlink(locToUnzip);

  const fetcher = new TarballFetcher(locToUnzip, {
    type: 'tarball',
    registry: 'npm',
    reference: `${assets[0].url}?access_token=${String(githubAuth0Token)}`,
    hash: null,
  }, config, false);
  await fetcher.fetch();

  // this links the downloaded release to bin/yarn.js
  await symlink(locToUnzip, path.resolve(updatesFolder, 'current'));

  // clean garbage
  const pathToClean = path.resolve(updatesFolder, 'to_clean');
  if (await exists(pathToClean)) {
    const previousVersionToCleanup = await realpath(pathToClean);
    await unlink(previousVersionToCleanup);
    await unlink(pathToClean);
  }

  if (isCurrentVersionAnUpdate) {
    // current yarn installation is an update, let's clean it next time an update is run
    // because it may still be in use now
    await symlink(thisVersionRoot, pathToClean);
  }

  reporter.success(reporter.lang('selfUpdateReleased', release.tag_name));
}
