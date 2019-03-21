'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPathKey = getPathKey;
const os = require('os');
const path = require('path');
const userHome = require('./util/user-home-dir').default;

var _require = require('./util/user-dirs');

const getCacheDir = _require.getCacheDir,
      getConfigDir = _require.getConfigDir,
      getDataDir = _require.getDataDir;

const isWebpackBundle = require('is-webpack-bundle');

const DEPENDENCY_TYPES = exports.DEPENDENCY_TYPES = ['devDependencies', 'dependencies', 'optionalDependencies', 'peerDependencies'];
const OWNED_DEPENDENCY_TYPES = exports.OWNED_DEPENDENCY_TYPES = ['devDependencies', 'dependencies', 'optionalDependencies'];

const RESOLUTIONS = exports.RESOLUTIONS = 'resolutions';
const MANIFEST_FIELDS = exports.MANIFEST_FIELDS = [RESOLUTIONS, ...DEPENDENCY_TYPES];

const SUPPORTED_NODE_VERSIONS = exports.SUPPORTED_NODE_VERSIONS = '^4.8.0 || ^5.7.0 || ^6.2.2 || >=8.0.0';

const YARN_REGISTRY = exports.YARN_REGISTRY = 'https://registry.yarnpkg.com';
const NPM_REGISTRY_RE = exports.NPM_REGISTRY_RE = /https?:\/\/registry\.npmjs\.org/g;

const YARN_DOCS = exports.YARN_DOCS = 'https://yarnpkg.com/en/docs/cli/';
const YARN_INSTALLER_SH = exports.YARN_INSTALLER_SH = 'https://yarnpkg.com/install.sh';
const YARN_INSTALLER_MSI = exports.YARN_INSTALLER_MSI = 'https://yarnpkg.com/latest.msi';

const SELF_UPDATE_VERSION_URL = exports.SELF_UPDATE_VERSION_URL = 'https://yarnpkg.com/latest-version';

// cache version, bump whenever we make backwards incompatible changes
const CACHE_VERSION = exports.CACHE_VERSION = 4;

// lockfile version, bump whenever we make backwards incompatible changes
const LOCKFILE_VERSION = exports.LOCKFILE_VERSION = 1;

// max amount of network requests to perform concurrently
const NETWORK_CONCURRENCY = exports.NETWORK_CONCURRENCY = 8;

// HTTP timeout used when downloading packages
const NETWORK_TIMEOUT = exports.NETWORK_TIMEOUT = 30 * 1000; // in milliseconds

// max amount of child processes to execute concurrently
const CHILD_CONCURRENCY = exports.CHILD_CONCURRENCY = 5;

const REQUIRED_PACKAGE_KEYS = exports.REQUIRED_PACKAGE_KEYS = ['name', 'version', '_uid'];

function getPreferredCacheDirectories() {
  const preferredCacheDirectories = [getCacheDir()];

  if (process.getuid) {
    // $FlowFixMe: process.getuid exists, dammit
    preferredCacheDirectories.push(path.join(os.tmpdir(), `.yarn-cache-${process.getuid()}`));
  }

  preferredCacheDirectories.push(path.join(os.tmpdir(), `.yarn-cache`));

  return preferredCacheDirectories;
}

const PREFERRED_MODULE_CACHE_DIRECTORIES = exports.PREFERRED_MODULE_CACHE_DIRECTORIES = getPreferredCacheDirectories();
const CONFIG_DIRECTORY = exports.CONFIG_DIRECTORY = getConfigDir();
const DATA_DIRECTORY = exports.DATA_DIRECTORY = getDataDir();
const LINK_REGISTRY_DIRECTORY = exports.LINK_REGISTRY_DIRECTORY = path.join(DATA_DIRECTORY, 'link');
const GLOBAL_MODULE_DIRECTORY = exports.GLOBAL_MODULE_DIRECTORY = path.join(DATA_DIRECTORY, 'global');

const NODE_BIN_PATH = exports.NODE_BIN_PATH = process.execPath;
const YARN_BIN_PATH = exports.YARN_BIN_PATH = getYarnBinPath();

// Webpack needs to be configured with node.__dirname/__filename = false
function getYarnBinPath() {
  if (isWebpackBundle) {
    return __filename;
  } else {
    return path.join(__dirname, '..', 'bin', 'yarn.js');
  }
}

const NODE_MODULES_FOLDER = exports.NODE_MODULES_FOLDER = 'node_modules';
const NODE_PACKAGE_JSON = exports.NODE_PACKAGE_JSON = 'package.json';

const PNP_FILENAME = exports.PNP_FILENAME = '.pnp.js';

const POSIX_GLOBAL_PREFIX = exports.POSIX_GLOBAL_PREFIX = `${process.env.DESTDIR || ''}/usr/local`;
const FALLBACK_GLOBAL_PREFIX = exports.FALLBACK_GLOBAL_PREFIX = path.join(userHome, '.yarn');

const META_FOLDER = exports.META_FOLDER = '.yarn-meta';
const INTEGRITY_FILENAME = exports.INTEGRITY_FILENAME = '.yarn-integrity';
const LOCKFILE_FILENAME = exports.LOCKFILE_FILENAME = 'yarn.lock';
const METADATA_FILENAME = exports.METADATA_FILENAME = '.yarn-metadata.json';
const TARBALL_FILENAME = exports.TARBALL_FILENAME = '.yarn-tarball.tgz';
const CLEAN_FILENAME = exports.CLEAN_FILENAME = '.yarnclean';

const NPM_LOCK_FILENAME = exports.NPM_LOCK_FILENAME = 'package-lock.json';
const NPM_SHRINKWRAP_FILENAME = exports.NPM_SHRINKWRAP_FILENAME = 'npm-shrinkwrap.json';

const DEFAULT_INDENT = exports.DEFAULT_INDENT = '  ';
const SINGLE_INSTANCE_PORT = exports.SINGLE_INSTANCE_PORT = 31997;
const SINGLE_INSTANCE_FILENAME = exports.SINGLE_INSTANCE_FILENAME = '.yarn-single-instance';

const ENV_PATH_KEY = exports.ENV_PATH_KEY = getPathKey(process.platform, process.env);

function getPathKey(platform, env) {
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

const VERSION_COLOR_SCHEME = exports.VERSION_COLOR_SCHEME = {
  major: 'red',
  premajor: 'red',
  minor: 'yellow',
  preminor: 'yellow',
  patch: 'green',
  prepatch: 'green',
  prerelease: 'red',
  unchanged: 'white',
  unknown: 'red'
};