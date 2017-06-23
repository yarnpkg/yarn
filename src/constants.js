/* @flow */

const path = require('path');
const userHome = require('./util/user-home-dir').default;

type Env = {
  [key: string]: ?string,
};

export const DEPENDENCY_TYPES = ['devDependencies', 'dependencies', 'optionalDependencies', 'peerDependencies'];

export const YARN_REGISTRY = 'https://registry.yarnpkg.com';

export const YARN_DOCS = 'https://yarnpkg.com/en/docs/cli/';
export const YARN_INSTALLER_SH = 'https://yarnpkg.com/install.sh';
export const YARN_INSTALLER_MSI = 'https://yarnpkg.com/latest.msi';

export const SELF_UPDATE_VERSION_URL = 'https://yarnpkg.com/latest-version';
export const SELF_UPDATE_TARBALL_URL = 'https://yarnpkg.com/latest.tar.gz';
export const SELF_UPDATE_DOWNLOAD_FOLDER = 'updates';

// cache version, bump whenever we make backwards incompatible changes
export const CACHE_VERSION = 1;

// lockfile version, bump whenever we make backwards incompatible changes
export const LOCKFILE_VERSION = 1;

// max amount of network requests to perform concurrently
export const NETWORK_CONCURRENCY = 8;

// HTTP timeout used when downloading packages
export const NETWORK_TIMEOUT = 30 * 1000; // in milliseconds

// max amount of child processes to execute concurrently
export const CHILD_CONCURRENCY = 5;

export const REQUIRED_PACKAGE_KEYS = ['name', 'version', '_uid'];

function getDirectory(category: string): string {
  // use %LOCALAPPDATA%/Yarn on Windows
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Yarn', category);
  }

  // otherwise use ~/.{category}/yarn
  return path.join(userHome, `.${category}`, 'yarn');
}

function getCacheDirectory(): string {
  if (process.platform === 'darwin') {
    return path.join(userHome, 'Library', 'Caches', 'Yarn');
  }

  return getDirectory('cache');
}

export const MODULE_CACHE_DIRECTORY = getCacheDirectory();
export const CONFIG_DIRECTORY = getDirectory('config');
export const LINK_REGISTRY_DIRECTORY = path.join(CONFIG_DIRECTORY, 'link');
export const GLOBAL_MODULE_DIRECTORY = path.join(CONFIG_DIRECTORY, 'global');
export const OSX_GLOBAL_PREFIX_DIRECTORY = '/usr/local';

export const META_FOLDER = '.yarn-meta';
export const INTEGRITY_FILENAME = '.yarn-integrity';
export const LOCKFILE_FILENAME = 'yarn.lock';
export const METADATA_FILENAME = '.yarn-metadata.json';
export const TARBALL_FILENAME = '.yarn-tarball.tgz';
export const CLEAN_FILENAME = '.yarnclean';

export const DEFAULT_INDENT = '  ';
export const SINGLE_INSTANCE_PORT = 31997;
export const SINGLE_INSTANCE_FILENAME = '.yarn-single-instance';

export const ENV_PATH_KEY = getPathKey(process.platform, process.env);

export function getPathKey(platform: string, env: Env): string {
  let pathKey = 'PATH';

  // windows calls its path "Path" usually, but this is not guaranteed.
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
