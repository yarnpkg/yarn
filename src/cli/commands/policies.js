/* @flow */
/* eslint-disable max-len */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {version} from '../../util/yarn-version.js';
import * as child from '../../util/child.js';
import buildSubCommands from './_build-sub-commands.js';
import {getRcConfigForFolder} from '../../rc.js';
import * as fs from '../../util/fs.js';
import {stringify} from '../../lockfile';
import {satisfiesWithPrereleases} from '../../util/semver.js';
import {NODE_BIN_PATH} from '../../constants';

const V2_NAMES = ['berry', 'stable', 'canary', 'v2', '2'];

const isLocalFile = (version: string) => version.match(/^\.{0,2}[\\/]/) || path.isAbsolute(version);
const isV2Version = (version: string) => satisfiesWithPrereleases(version, '>=2.0.0');

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
    const initialRange = args[0] || 'latest';
    let range = initialRange;

    let allowRc = flags.rc;

    if (range === 'rc') {
      reporter.log(
        `${chalk.yellow(
          `Warning:`,
        )} Your current Yarn binary is currently Yarn ${version}; to avoid potential breaking changes, 'set version rc' won't receive upgrades past the 1.22.x branch.\n         To upgrade to the latest versions, run ${chalk.cyan(
          `yarn set version`,
        )} ${chalk.yellow.underline(`canary`)} instead. Sorry for the inconvenience.\n`,
      );

      range = '*';
      allowRc = true;
    }

    if (range === 'latest') {
      reporter.log(
        `${chalk.yellow(
          `Warning:`,
        )} Your current Yarn binary is currently Yarn ${version}; to avoid potential breaking changes, 'set version latest' won't receive upgrades past the 1.22.x branch.\n         To upgrade to the latest versions, run ${chalk.cyan(
          `yarn set version`,
        )} ${chalk.yellow.underline(`stable`)} instead. Sorry for the inconvenience.\n`,
      );

      range = '*';
    }

    if (range === 'classic') {
      range = '*';
    }

    let bundleUrl;
    let bundleVersion;
    const isV2 = false;

    if (range === 'nightly' || range === 'nightlies') {
      reporter.log(
        `${chalk.yellow(
          `Warning:`,
        )} Nightlies only exist for Yarn 1.x; starting from 2.x onwards, you should use 'canary' instead`,
      );

      bundleUrl = 'https://nightly.yarnpkg.com/latest.js';
      bundleVersion = 'nightly';
    } else if (V2_NAMES.includes(range) || isLocalFile(range) || isV2Version(range)) {
      const normalizedRange = isV2Version(range) ? range : range === `canary` ? `canary` : `stable`;

      if (process.env.COREPACK_ROOT) {
        await child.spawn(
          NODE_BIN_PATH,
          [
            path.join(process.env.COREPACK_ROOT, 'dist/corepack.js'),
            `yarn@${normalizedRange}`,
            `set`,
            `version`,
            normalizedRange,
          ],
          {
            stdio: 'inherit',
            cwd: config.cwd,
          },
        );

        return;
      } else {
        const bundle = await fetchBundle(
          config,
          'https://github.com/yarnpkg/berry/raw/master/packages/yarnpkg-cli/bin/yarn.js',
        );

        const yarnPath = path.resolve(config.lockfileFolder, `.yarn/releases/yarn-stable-temp.cjs`);
        await fs.mkdirp(path.dirname(yarnPath));
        await fs.writeFile(yarnPath, bundle);
        await fs.chmod(yarnPath, 0o755);

        try {
          await child.spawn(NODE_BIN_PATH, [yarnPath, 'set', 'version', range], {
            stdio: 'inherit',
            cwd: config.lockfileFolder,
            env: {
              ...process.env,
              YARN_IGNORE_PATH: `1`,
            },
          });
        } catch (err) {
          // eslint-disable-next-line no-process-exit
          process.exit(1);
        }

        return;
      }
    } else {
      reporter.log(`Resolving ${chalk.yellow(initialRange)} to a url...`);

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
