import Immutable from 'immutable';

export class Environment
  extends (new Immutable.Record({
    // True if Yarn is allowed to use the network

    NETWORK_ENABLED: true,

    // The registry used

    REGISTRY_URL: `https://registry.yarnpkg.com`,

    // The amount of time allowed before any one fetch request is dropped

    FETCH_TIMEOUT: 30000,

    // The path to the cache

    CACHE_PATH: undefined,

    // The path to the mirror

    MIRROR_PATH: undefined,

    // The path that file dependencies should be resolved against

    RELATIVE_DEPENDENCIES_PATH: undefined,

    // The filename of the marker used to flag a folder as having been correctly installed
    // If this file is missing, the cache will assume that the installation in this directory has somehow failed, erase it, and retry

    ATOMIC_FILENAME: `.yarn-ok`,

    // The filename of the original archive, when stored in the cache

    ARCHIVE_FILENAME: `.yarn-archive.tgz`,

    // The filename of the file that contains the resolved package info. Always included by final fetchers

    INFO_FILENAME: `.yarn-info.json`,
  })) {}
