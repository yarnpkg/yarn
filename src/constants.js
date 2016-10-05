/* @flow */

const userHome = require('user-home');
const path = require('path');
const fs = require('fs');

type Env = {[key: string]: ?string};

const cwd = process.cwd();

export const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
];

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

export function getAppData(env: Env): ?string {
  for (const key in env) {
    if (key.toLowerCase() === 'appdata') {
      return env[key];
    }
  }
  return null;
}

export function getModuleCacheDirectory(): string {
  // use %APPDATA%/Yarn on Windows
  if (process.platform === 'win32') {
    const appData = getAppData(process.env);
    if (appData) {
      return path.join(appData, 'Yarn');
    }
  }

  // otherwise use ~/.yarn
  const name = or(['.fbkpm', '.kpm', '.yarn'], userHome);
  return path.join(userHome, name);
}

// the kpm and fbkpm names here are legacy names for yarn here for compatibility

export const MODULE_CACHE_DIRECTORY = getModuleCacheDirectory();
export const LINK_REGISTRY_DIRECTORY = `${MODULE_CACHE_DIRECTORY}/.link`;
export const GLOBAL_MODULE_DIRECTORY = `${MODULE_CACHE_DIRECTORY}/.global`;

export const INTEGRITY_FILENAME = or(
  ['.fbkpm-integrity', '.kpm-integrity', '.yarn-integrity'],
  path.join(cwd, 'node_modules'),
);
export const LOCKFILE_FILENAME = or(['fbkpm.lock', 'kpm.lock', 'yarn.lock'], cwd);
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
