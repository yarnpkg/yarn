/* @flow */

import type {FetchedMetadata} from './types.js';
import type PackageResolver from './package-resolver.js';
import type {Fetchers} from './fetchers/index.js';
import type {Reporter} from './reporters/index.js';
import type PackageReference from './package-reference.js';
import type Config from './config.js';
import {MessageError} from './errors.js';
import * as fetchers from './fetchers/index.js';
import * as fs from './util/fs.js';
import * as promise from './util/promise.js';

export default class PackageFetcher {
  constructor(config: Config, resolver: PackageResolver) {
    this.reporter = config.reporter;
    this.resolver = resolver;
    this.config = config;
  }

  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;

  async fetchCache(dest: string, fetcher: Fetchers): Promise<FetchedMetadata> {
    const {hash, package: pkg} = await this.config.readPackageMetadata(dest);
    await fetcher.setupMirrorFromCache();
    return {
      package: pkg,
      hash,
      dest,
      cached: true,
    };
  }

  async fetch(ref: PackageReference): Promise<FetchedMetadata> {
    const dest = this.config.generateHardModulePath(ref);

    const remote = ref.remote;
    const Fetcher = fetchers[remote.type];
    if (!Fetcher) {
      throw new MessageError(this.reporter.lang('unknownFetcherFor', remote.type));
    }

    const fetcher = new Fetcher(dest, remote, this.config);
    if (await this.config.isValidModuleDest(dest)) {
      return this.fetchCache(dest, fetcher);
    }

    // remove as the module may be invalid
    await fs.unlink(dest);

    try {
      return await fetcher.fetch();
    } catch (err) {
      try {
        await fs.unlink(dest);
      } catch (err2) {
        // what do?
      }
      throw err;
    }
  }

  async maybeFetch(ref: PackageReference): Promise<?FetchedMetadata> {
    try {
      return await this.fetch(ref);
    } catch (err) {
      if (ref.optional) {
        this.reporter.error(err.message);
        return null;
      } else {
        throw err;
      }
    }
  }

  async init(): Promise<void> {
    let pkgs = this.resolver.getPackageReferences();
    const pkgsPerDest: Map<string, PackageReference> = new Map();
    pkgs = pkgs.filter(ref => {
      const dest = this.config.generateHardModulePath(ref);
      const otherPkg = pkgsPerDest.get(dest);
      if (otherPkg) {
        this.reporter.warn(
          this.reporter.lang('multiplePackagesCantUnpackInSameDestination', ref.patterns, dest, otherPkg.patterns),
        );
        return false;
      }
      pkgsPerDest.set(dest, ref);
      return true;
    });
    const tick = this.reporter.progress(pkgs.length);

    await promise.queue(
      pkgs,
      async ref => {
        const res = await this.maybeFetch(ref);
        let newPkg;

        if (res) {
          newPkg = res.package;

          // update with new remote
          // but only if there was a hash previously as the tarball fetcher does not provide a hash.
          if (ref.remote.hash) {
            ref.remote.hash = res.hash;
          }
        }

        if (newPkg) {
          // update with fresh manifest
          await this.resolver.updateManifest(ref, newPkg);
        }

        if (tick) {
          tick(ref.name);
        }
      },
      this.config.networkConcurrency,
    );
  }
}
