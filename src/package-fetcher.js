/* @flow */

import { PackageInfo } from "./types";
import type PackageResolver from "./package-resolver";
import type Reporter from "./reporters/_base";
import type PackageReference from "./package-reference";
import type Config from "./config";
import * as fetchers from "./fetchers";
import * as fs from "./util/fs";
import * as promise from "./util/promise";

let invariant = require("invariant");

export default class PackageFetcher {
  constructor(config: Config, reporter: Reporter, resolver: PackageResolver) {
    this.reporter = reporter;
    this.resolver = resolver;
    this.config   = config;
  }

  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;

  async fetch(ref: PackageReference): Promise<{
    package: PackageInfo,
    hash: string
  }> {
    let dest = this.config.generateHardModulePath(ref);

    if (await fs.isValidModuleDest(dest)) {
      let { hash, package: pkg } = await fs.readPackageMetadata(dest);
      return {
        package: pkg,
        hash: hash
      };
    }

    // remove as the module may be invalid
    await fs.unlink(dest);

    let remote = ref.remote;
    invariant(remote, "Missing remote");

    let Fetcher = fetchers[remote.type];
    if (!Fetcher) throw new Error(`Unknown fetcher for ${remote.type}`);

    let fetcher = new Fetcher(remote, this.config);
    return fetcher.fetch(dest);
  }

  async init(): Promise<void> {
    let self = this;
    let pkgs = this.resolver.getPackageReferences();
    let tick = this.reporter.progress(pkgs.length);

    await promise.queue(pkgs, (ref) => {
      let promise = self.fetch(ref).then((res) => {
        if (res.hash) {
          ref.hash = res.hash;
        }

        return self.resolver.updatePackageInfo(ref, res.package).then(function () {
          tick(ref.name);
        });
      });

      if (ref.optional) {
        promise = promise.catch((err) => {
          self.reporter.error(err.message);
        });
      }

      return promise;
    });
  }
}
