/* @flow */

const userHome = require('user-home');
const path = require('path');
const pkg = require('../package.json');
const fs = require('fs');

const cwd = process.cwd();

// lockfile version, bump whenever we make backwards incompatible changes
export const LOCKFILE_VERSION = 1;

// max amount of network requests to perform concurrently
export const NETWORK_CONCURRENCY = 15;

// max amount of child processes to execute concurrently
export const CHILD_CONCURRENCY = 5;

export const REQUIRED_PACKAGE_KEYS = ['name', 'version', '_uid'];

function or(filenames: Array<string>, cwd: string): string {
  for (const filename of filenames) {
    const loc = path.join(cwd, filename);
    if (fs.existsSync(loc)) {
      return filename;
    }
  }

  return filenames.pop();
}

// the kpm and fbkpm names here are legacy names for yarn here for compatibility
export const DEFAULT_PORT_FOR_SINGLE_INSTANCE = 31997;
export const MODULE_CACHE_DIRECTORY = or(['.fbkpm', '.kpm', '.yarn'], userHome);
export const INTEGRITY_FILENAME = or(
  ['.fbkpm-integrity', '.kpm-integrity', '.yarn-integrity'],
  path.join(cwd, 'node_modules'),
);
export const LOCKFILE_FILENAME = or(['fbkpm.lock', 'kpm.lock', 'yarn.lock'], cwd);
export const METADATA_FILENAME = '.yarn-metadata.json';
export const TARBALL_FILENAME = '.yarn-tarball.tgz';
export const CLEAN_FILENAME = '.yarnclean';
export const SINGLE_INSTANCE_FILENAME = '.yarn-single-instance';

export const USER_AGENT = `kpm v${pkg.version}`;

export const GITHUB_USER = 'yarnpkg';
export const GITHUB_REPO = 'yarn';
export const SELF_UPDATE_DOWNLOAD_FOLDER = 'updates';

export const ENV_PATH_KEY = getPathKey(process.platform, process.env);

export function getPathKey(platform: string, env: { [key: string]: ?string }): string {
  let pathKey = 'PATH';

  // windows calls it's path "Path" usually, but this is not guaranteed.
  if (platform === 'win32') {
    pathKey = 'Path';

    for (const key in env) {
      if (key.toLowerCase() === 'path') {
        pathKey = key;
      }
    }
  }

  return pathKey;
}
