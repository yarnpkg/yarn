/* @flow */

const userHome = require('user-home');
const path = require('path');

type Env = {[key: string]: ?string};

export const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
];

export const YARN_REGISTRY = 'https://registry.yarnpkg.com';

// lockfile version, bump whenever we make backwards incompatible changes
export const LOCKFILE_VERSION = 1;

// max amount of network requests to perform concurrently
export const NETWORK_CONCURRENCY = 15;

// max amount of child processes to execute concurrently
export const CHILD_CONCURRENCY = 5;

export const REQUIRED_PACKAGE_KEYS = ['name', 'version', '_uid'];

function getDirectory(type: string): string {
  // use %LOCALAPPDATA%/Yarn on Windows
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Yarn', type);
  }

  // otherwise use ~/.yarn
  return path.join(userHome, `.yarn-${type}`);
}

export const MODULE_CACHE_DIRECTORY = getDirectory('cache');
export const LINK_REGISTRY_DIRECTORY = getDirectory('config/link');
export const GLOBAL_MODULE_DIRECTORY = getDirectory('config/global');

export const INTEGRITY_FILENAME = '.yarn-integrity';
export const LOCKFILE_FILENAME = 'yarn.lock';
export const METADATA_FILENAME = '.yarn-metadata.json';
export const TARBALL_FILENAME = '.yarn-tarball.tgz';
export const CLEAN_FILENAME = '.yarnclean';

export const SINGLE_INSTANCE_PORT = 31997;
export const SINGLE_INSTANCE_FILENAME = '.yarn-single-instance';

export const GITHUB_USER = 'yarnpkg';
export const GITHUB_REPO = 'yarn';
export const SELF_UPDATE_DOWNLOAD_FOLDER = 'updates';

export const ENV_PATH_KEY = getPathKey(process.platform, process.env);

export function getPathKey(platform: string, env: Env): string {
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
