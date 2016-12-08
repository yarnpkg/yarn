/* @flow */

const path = require('path');
let userHome = require('user-home');

if (process.platform === 'linux' && isRootUser(getUid())) {
  userHome = path.resolve('/usr/local/share');
}

type Env = {
  [key: string]: ? string
};

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

function getDirectory(category: string): string {
  // use %LOCALAPPDATA%/Yarn on Windows
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Yarn', category);
  }

  // otherwise use ~/.yarn
  return path.join(userHome, `.${category}`, 'yarn');
}

function getCacheDirectory(): string {
  if (process.platform === 'darwin') {
    return path.join(userHome, 'Library', 'Caches', 'Yarn');
  }

  return getDirectory('cache');
}

export const GLOBAL_INSTALL_DIRECTORY = path.join(userHome, '.yarn');
export const MODULE_CACHE_DIRECTORY = getCacheDirectory();
export const CONFIG_DIRECTORY = getDirectory('config');
export const LINK_REGISTRY_DIRECTORY = path.join(CONFIG_DIRECTORY, 'link');
export const GLOBAL_MODULE_DIRECTORY = path.join(CONFIG_DIRECTORY, 'global');
export const CACHE_FILENAME = path.join(MODULE_CACHE_DIRECTORY, '.roadrunner.json');

export const INTEGRITY_FILENAME = '.yarn-integrity';
export const LOCKFILE_FILENAME = 'yarn.lock';
export const METADATA_FILENAME = '.yarn-metadata.json';
export const TARBALL_FILENAME = '.yarn-tarball.tgz';
export const CLEAN_FILENAME = '.yarnclean';

export const DEFAULT_INDENT = '  ';
export const SINGLE_INSTANCE_PORT = 31997;
export const SINGLE_INSTANCE_FILENAME = '.yarn-single-instance';

export const SELF_UPDATE_VERSION_URL = 'https://yarnpkg.com/latest-version';
export const SELF_UPDATE_TARBALL_URL = 'https://yarnpkg.com/latest.tar.gz';
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

function getUid(): ?number {
  if (process.platform !== 'win32' && process.getuid) {
    return process.getuid();
  }
  return null;
}

export const ROOT_USER = isRootUser(getUid());

export function isRootUser(uid: ?number): boolean {
  return uid === 0;
}
