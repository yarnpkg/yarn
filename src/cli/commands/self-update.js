/* @flow */

import roadrunner from 'roadrunner';
import semver from 'semver';
import path from 'path';
import type Config from '../../config.js';
import {
  CACHE_FILENAME,
  SELF_UPDATE_DOWNLOAD_FOLDER,
  SELF_UPDATE_TARBALL_URL,
  SELF_UPDATE_VERSION_URL,
} from '../../constants.js';
import TarballFetcher from '../../fetchers/tarball-fetcher.js';
import type {Reporter} from '../../reporters/index.js';
import {exists, realpath, symlink, unlink} from '../../util/fs.js';

export const noArguments = true;
export const requireLockfile = false;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const currentVersion = flags.version();
  const latestVersion = await config.requestManager.request({
    url: SELF_UPDATE_VERSION_URL,
    headers: {
      'Accept': 'text/plain',
    },
  });

  // Check if we already use the latest or a newer version
  if (semver.compare(currentVersion, latestVersion) >= 0) {
    reporter.success(reporter.lang('selfUpdateNoNewer'));
    return;
  }

  reporter.info(reporter.lang('selfUpdateDownloading', latestVersion));

  const thisVersionRoot = path.resolve(__dirname, '..', '..', '..');
  let updatesFolder = path.resolve(thisVersionRoot, '..');
  const isCurrentVersionAnUpdate = path.basename(updatesFolder) === SELF_UPDATE_DOWNLOAD_FOLDER;

  if (!isCurrentVersionAnUpdate) {
    updatesFolder = path.resolve(thisVersionRoot, SELF_UPDATE_DOWNLOAD_FOLDER);
  }

  const locToUnzip = path.resolve(updatesFolder, latestVersion);

  await unlink(locToUnzip);

  const fetcher = new TarballFetcher(locToUnzip, {
    type: 'tarball',
    registry: 'yarn',
    reference: SELF_UPDATE_TARBALL_URL,
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

  // reset the roadrunner cache
  roadrunner.reset(CACHE_FILENAME);

  reporter.success(reporter.lang('selfUpdateReleased', latestVersion));
}
