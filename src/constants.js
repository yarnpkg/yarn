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

// max amount of network requests to perform concurrently
export const NETWORK_CONCURRENCY = 15;

// max amount of child processes to execute concurrently
export const CHILD_CONCURRENCY = 5;

export const REQUIRED_PACKAGE_KEYS = ["name", "version", "uid"];

export const MODULE_CACHE_DIRECTORY = ".fbkpm";
export const LOCKFILE_FILENAME      = "fbkpm.lock";
export const INTEGRITY_FILENAME     = ".fbkpm-integrity";
export const METADATA_FILENAME      = ".fbkpm-metadata.json";
export const SINGLE_SOCKET_FILENAME = ".fbkpm-single-socket";

export const USER_AGENT = "fbkpm";

export const ENV_PATH_KEY = getPathKey(process.platform, process.env);

export function getPathKey(platform: string, env: { [key: string]: any }): string {
  let pathKey = "PATH";

  // windows calls it's path "Path" usually, but this is not guaranteed.
  if (platform === "win32") {
    pathKey = "Path";

    for (let key in env) {
      if (key.toLowerCase() === "path") {
        pathKey = key;
      }
    }
  }

  return pathKey;
}
