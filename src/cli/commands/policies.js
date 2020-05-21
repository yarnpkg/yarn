/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import {getRcConfigForFolder} from '../../rc.js';
import * as fs from '../../util/fs.js';
import {stringify} from '../../lockfile';

const chalk = require('chalk');
const invariant = require('invariant');
const path = require('path');
const semver = require('semver');

type ReleaseAsset = {|
  id: any,

  name: string,
  browser_download_url: string,
|};

type Release = {|
  id: any,

  draft: boolean,
  prerelease: boolean,

  tag_name: string,
  version: {|
    version: string,
  |},

  assets: Array<ReleaseAsset>,
|};

function getBundleAsset(release: Release): ?ReleaseAsset {
  return release.assets.find(asset => {
    return asset.name.match(/^yarn-[0-9]+\.[0-9]+\.[0-9]+\.js$/);
  });
}

type FetchReleasesOptions = {|
  includePrereleases: boolean,
|};

async function fetchReleases(
  config: Config,
  {includePrereleases = false}: FetchReleasesOptions = {},
): Promise<Array<Release>> {
  const token = process.env.GITHUB_TOKEN;
  const tokenUrlParameter = token ? `?access_token=${token}` : '';
  const request: Array<Release> = await config.requestManager.request({
    url: `https://api.github.com/repos/yarnpkg/yarn/releases${tokenUrlParameter}`,
    json: true,
  });

  const releases = request.filter(release => {
    if (release.draft) {
      return false;
    }

    if (release.prerelease && !includePrereleases) {
      return false;
    }

    // $FlowFixMe
    release.version = semver.coerce(release.tag_name);

    if (!release.version) {
      return false;
    }

    if (!getBundleAsset(release)) {
      return false;
    }

    return true;
  });

  releases.sort((a, b) => {
    // $FlowFixMe
    return -semver.compare(a.version, b.version);
  });

  return releases;
}

function fetchBundle(config: Config, url: string): Promise<Buffer> {
  return config.requestManager.request({
    url,
    buffer: true,
  });
}

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return false;
}

const {run, setFlags, examples} = buildSubCommands('policies', {
  async setVersion(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    let range = args[0] || 'latest';
    let allowRc = flags.rc;

    reporter.log(`Resolving ${chalk.yellow(range)} to a url...`);

    if (range === 'rc') {
      range = 'latest';
      allowRc = true;
    }

    if (range === 'latest') {
      range = '*';
    }

    let bundleUrl;
    let bundleVersion;
    let isV2 = false;

    if (range === 'nightly' || range === 'nightlies') {
      bundleUrl = 'https://nightly.yarnpkg.com/latest.js';
      bundleVersion = 'nightly';
    } else if (range === 'berry' || range === 'v2' || range === '2') {
      bundleUrl = 'https://github.com/yarnpkg/berry/raw/master/packages/berry-cli/bin/berry.js';
      bundleVersion = 'berry';
      isV2 = true;
    } else {
      let releases = [];

      try {
        releases = await fetchReleases(config, {
          includePrereleases: allowRc,
        });
      } catch (e) {
        reporter.error(e.message);
        return;
      }

      const release = releases.find(release => {
        // $FlowFixMe
        return semver.satisfies(release.version, range);
      });

      if (!release) {
        throw new Error(`Release not found: ${range}`);
      }

      const asset = getBundleAsset(release);
      invariant(asset, 'The bundle asset should exist');

      bundleUrl = asset.browser_download_url;
      bundleVersion = release.version.version;
    }

    reporter.log(`Downloading ${chalk.green(bundleUrl)}...`);

    const bundle = await fetchBundle(config, bundleUrl);

    const yarnPath = path.resolve(config.lockfileFolder, `.yarn/releases/yarn-${bundleVersion}.cjs`);
    reporter.log(`Saving it into ${chalk.magenta(yarnPath)}...`);
    await fs.mkdirp(path.dirname(yarnPath));
    await fs.writeFile(yarnPath, bundle);
    await fs.chmod(yarnPath, 0o755);

    const targetPath = path.relative(config.lockfileFolder, yarnPath).replace(/\\/g, '/');

    if (isV2) {
      const rcPath = `${config.lockfileFolder}/.yarnrc.yml`;
      reporter.log(`Updating ${chalk.magenta(rcPath)}...`);

      await fs.writeFilePreservingEol(rcPath, `yarnPath: ${JSON.stringify(targetPath)}\n`);
    } else {
      const rcPath = `${config.lockfileFolder}/.yarnrc`;
      reporter.log(`Updating ${chalk.magenta(rcPath)}...`);

      const rc = getRcConfigForFolder(config.lockfileFolder);
      rc['yarn-path'] = targetPath;

      await fs.writeFilePreservingEol(rcPath, `${stringify(rc)}\n`);
    }

    reporter.log(`Done!`);
  },
});

export {run, setFlags, examples};
