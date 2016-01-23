/* @flow */

// max amount of network requests to perform concurrently
export const NETWORK_CONCURRENCY = 15;

// max amount of child processes to execute concurrently
export const CHILD_CONCURRENCY = 5;

export const REQUIRED_PACKAGE_KEYS = ["name", "version", "uid"];

export const SHRINKWRAP_FILENAME = "kpm-shrinkwrap.json";
export const LOCKFILE_FILENAME   = ".kpm-lock";
export const METADATA_FILENAME   = ".kpm-metadata.json";

export const USER_AGENT = "kpm";

export const BOWER_REGISTRY_URL = "https://bower.herokuapp.com";
export const NPM_REGISTRY_URL   = "https://registry.npmjs.org";

// we purposefully omit https and http as those are only valid if they end in the .git extension
export const GIT_PROTOCOLS = ["git", "git+ssh", "git+https", "ssh"];

export let ENV_PATH_KEY = "PATH";

// windows calls it's path "Path" usually, but this is not guaranteed.
if (process.platform === "win32") {
  ENV_PATH_KEY = "Path";

  for (let key in process.env) {
    if (key.match(/^PATH$/i)) {
      ENV_PATH_KEY = key;
    }
  }
}
