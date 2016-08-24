/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

const userHome = require('user-home');
const path = require('path');
const pkg = require('../package.json');
const fs = require('fs');

const cwd = process.cwd();

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

export const MODULE_CACHE_DIRECTORY = or(['.fbkpm', '.kpm'], userHome);
export const SINGLE_SOCKET_FILENAME = '.kpm-single-socket';
export const INTEGRITY_FILENAME = or(['.fbkpm-integrity', '.kpm-integrity'], path.join(cwd, 'node_modules'));
export const LOCKFILE_FILENAME = or(['fbkpm.lock', 'kpm.lock'], cwd);
export const METADATA_FILENAME = '.kpm-metadata.json';
export const CLEAN_FILENAME = '.kpmclean';

export const USER_AGENT = `kpm v${pkg.version}`;

export const ENV_PATH_KEY = getPathKey(process.platform, process.env);

export function getPathKey(platform: string, env: { [key: string]: any }): string {
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
