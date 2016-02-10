/* @flow */

import type { FetchedPackageInfo } from "./types.js";
import type PackageResolver from "./package-resolver.js";
import type Reporter from "./reporters/_base.js";
import type PackageReference from "./package-reference.js";
import type Config from "./config.js";
import * as fetchers from "./fetchers/index.js";
import * as fs from "./util/fs.js";
import * as promise from "./util/promise.js";

let invariant = require("invariant");

export default class PackageFetcher {
  constructor(config: Config, resolver: PackageResolver) {
    this.reporter = config.reporter;
    this.resolver = resolver;
    this.config   = config;
  }

  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;

  async fetch(ref: PackageReference): Promise<FetchedPackageInfo> {
    let dest = this.config.generateHardModulePath(ref);

    if (await fs.isValidModuleDest(dest)) {
      let { hash, package: pkg } = await fs.readPackageMetadata(dest);
      return {
        package: pkg,
        hash,
        dest
      };
    }

    // remove as the module may be invalid
    await fs.unlink(dest);

    let remote = ref.remote;
    invariant(remote, "Missing remote");

    let Fetcher = fetchers[remote.type];
    if (!Fetcher) throw new Error(`Unknown fetcher for ${remote.type}`);

    await fs.mkdirp(dest);

    try {
      let fetcher = new Fetcher(remote, this.config);
      return await fetcher.fetch(dest);
    } catch (err) {
      await fs.unlink(dest);
      throw err;
    }
  }

  async maybeFetch(ref: PackageReference): Promise<?FetchedPackageInfo> {
    let promise = this.fetch(ref);

    if (ref.optional) {
      // swallow the error
      promise = promise.catch((err) => {
        // TODO we want to throw for PackageResolver use
        this.reporter.error(err.message);
      });
    }

    return promise;
  }

  async init(): Promise<void> {
    let pkgs = this.resolver.getPackageReferences();
    let tick = this.reporter.progress(pkgs.length);

    await promise.queue(pkgs, (ref) => this.maybeFetch(ref).then((res) => {
      if (res) {
        ref.remote.hash = res.hash;
        return this.resolver.updatePackageInfo(ref, res.package).then(function () {
          if (tick) tick(ref.name);
        });
      }
    }));
  }
}
