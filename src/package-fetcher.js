/* @flow */

import type {FetchedMetadata} from './types.js';
import type PackageResolver from './package-resolver.js';
import type {Fetchers} from './fetchers/index.js';
import type {Reporter} from './reporters/index.js';
import type PackageReference from './package-reference.js';
import type Config from './config.js';
import * as fetchers from './fetchers/index.js';
import * as fs from './util/fs.js';
import * as promise from './util/promise.js';

const path = require('path');

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
    return {
      package: pkg,
      resolved: await fetcher.getResolvedFromCached(hash),
      hash,
      dest,
    };
  }

  async fetch(ref: PackageReference): Promise<FetchedMetadata> {
    const dest = this.config.generateHardModulePath(ref);

    const remote = ref.remote;
    const Fetcher = fetchers[remote.type];
    if (!Fetcher) {
      throw new Error(`Unknown fetcher for ${remote.type}`);
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
    const pkgs = this.resolver.getPackageReferences();
    const tick = this.reporter.progress(pkgs.length);

    await promise.queue(pkgs, async (ref) => {
      const res = await this.maybeFetch(ref);
      let newPkg;

      if (res) {
        newPkg = res.package;

        // update with new remote
        ref.remote.hash = res.hash;
        if (res.resolved) {
          ref.remote.resolved = res.resolved;
        }
      }

      if (newPkg) {
        // read linked module manifest if one exists
        if (ref.shouldLink()) {
          const linkPkg = await this.config.readManifest(path.join(this.config.linkFolder, ref.name));

          // copy over fields that will influence the lockfile
          linkPkg.name = newPkg.name;
          linkPkg.version = newPkg.version;
          linkPkg.dependencies = newPkg.dependencies;
          linkPkg.optionalDependencies = newPkg.optionalDependencies;

          newPkg = linkPkg;
        }

        // update with fresh manifest
        await this.resolver.updateManifest(ref, newPkg);
      }

      if (tick) {
        tick(ref.name);
      }
    });
  }
}
