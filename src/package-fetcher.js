/* @flow */

import type {FetchedMetadata, Manifest, PackageRemote} from './types.js';
import type {Fetchers} from './fetchers/index.js';
import type PackageReference from './package-reference.js';
import type Config from './config.js';
import {MessageError, SecurityError} from './errors.js';
import * as fetchers from './fetchers/index.js';
import * as fs from './util/fs.js';
import * as promise from './util/promise.js';

const ssri = require('ssri');

async function fetchCache(
  dest: string,
  fetcher: Fetchers,
  config: Config,
  remote: PackageRemote,
): Promise<FetchedMetadata> {
  // $FlowFixMe: This error doesn't make sense
  const {hash, package: pkg, remote: cacheRemote} = await config.readPackageMetadata(dest);

  const cacheIntegrity = cacheRemote.cacheIntegrity || cacheRemote.integrity;
  const cacheHash = cacheRemote.hash;

  if (remote.integrity) {
    if (!cacheIntegrity || !ssri.parse(cacheIntegrity).match(remote.integrity)) {
      throw new SecurityError(
        config.reporter.lang('fetchBadIntegrityCache', pkg.name, cacheIntegrity, remote.integrity),
      );
    }
  }

  if (remote.hash) {
    if (!cacheHash || cacheHash !== remote.hash) {
      throw new SecurityError(config.reporter.lang('fetchBadHashCache', pkg.name, cacheHash, remote.hash));
    }
  }

  await fetcher.setupMirrorFromCache();
  return {
    package: pkg,
    hash,
    dest,
    cached: true,
  };
}

export async function fetchOneRemote(
  remote: PackageRemote,
  name: string,
  version: string,
  dest: string,
  config: Config,
): Promise<FetchedMetadata> {
  // Mock metadata for symlinked dependencies
  if (remote.type === 'link') {
    const mockPkg: Manifest = {_uid: '', name: '', version: '0.0.0'};
    return Promise.resolve({resolved: null, hash: '', dest, package: mockPkg, cached: false});
  }

  const Fetcher = fetchers[remote.type];
  if (!Fetcher) {
    throw new MessageError(config.reporter.lang('unknownFetcherFor', remote.type));
  }

  const fetcher = new Fetcher(dest, remote, config);
  if (await config.isValidModuleDest(dest)) {
    return fetchCache(dest, fetcher, config, remote);
  }

  // remove as the module may be invalid
  await fs.unlink(dest);

  try {
    return await fetcher.fetch({
      name,
      version,
    });
  } catch (err) {
    try {
      await fs.unlink(dest);
    } catch (err2) {
      // what do?
    }
    throw err;
  }
}

function fetchOne(ref: PackageReference, config: Config): Promise<FetchedMetadata> {
  const dest = config.generateModuleCachePath(ref);

  return fetchOneRemote(ref.remote, ref.name, ref.version, dest, config);
}

async function maybeFetchOne(ref: PackageReference, config: Config): Promise<?FetchedMetadata> {
  try {
    return await fetchOne(ref, config);
  } catch (err) {
    if (ref.optional) {
      config.reporter.error(err.message);
      return null;
    } else {
      throw err;
    }
  }
}

export function fetch(pkgs: Array<Manifest>, config: Config): Promise<Array<Manifest>> {
  const pkgsPerDest: Map<string, PackageReference> = new Map();
  pkgs = pkgs.filter(pkg => {
    const ref = pkg._reference;
    if (!ref) {
      return false;
    }
    const dest = config.generateModuleCachePath(ref);
    const otherPkg = pkgsPerDest.get(dest);
    if (otherPkg) {
      config.reporter.warn(
        config.reporter.lang('multiplePackagesCantUnpackInSameDestination', ref.patterns, dest, otherPkg.patterns),
      );
      return false;
    }
    pkgsPerDest.set(dest, ref);
    return true;
  });
  const tick = config.reporter.progress(pkgs.length);

  return promise.queue(
    pkgs,
    async pkg => {
      const ref = pkg._reference;
      if (!ref) {
        return pkg;
      }

      const res = await maybeFetchOne(ref, config);
      let newPkg;

      if (res) {
        newPkg = res.package;

        // update with new remote
        // but only if there was a hash previously as the tarball fetcher does not provide a hash.
        if (ref.remote.hash) {
          // if the checksum was updated, also update resolved and cache
          if (ref.remote.hash !== res.hash && config.updateChecksums) {
            const oldHash = ref.remote.hash;
            if (ref.remote.resolved) {
              ref.remote.resolved = ref.remote.resolved.replace(oldHash, res.hash);
            }
            ref.config.cache = Object.keys(ref.config.cache).reduce((cache, entry) => {
              const entryWithNewHash = entry.replace(oldHash, res.hash);
              cache[entryWithNewHash] = ref.config.cache[entry];
              return cache;
            }, {});
          }
          ref.remote.hash = res.hash || ref.remote.hash;
        }
      }

      if (tick) {
        tick();
      }

      if (newPkg) {
        newPkg._reference = ref;
        newPkg._remote = ref.remote;
        newPkg.name = pkg.name;
        newPkg.fresh = pkg.fresh;
        return newPkg;
      }

      return pkg;
    },
    config.networkConcurrency,
  );
}
