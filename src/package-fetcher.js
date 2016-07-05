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

import type { FetchedManifest } from "./types.js";
import type PackageResolver from "./package-resolver.js";
import type { Reporter } from "kreporters";
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

  async fetch(reference: PackageReference, overwriteDestination: boolean): Promise<FetchedManifest> {
    let dest = this.config.generateHardModulePath(reference);

    if (!overwriteDestination && await this.config.isValidModuleDest(dest)) {
      let { hash, package: pkg } = await this.config.readPackageMetadata(dest);
      return {
        package: pkg,
        hash,
        dest
      };
    }

    // remove as the module may be invalid
    await fs.unlink(dest);

    let remote = reference.remote;
    invariant(remote, "Missing remote");

    let Fetcher = fetchers[remote.type];
    if (!Fetcher) throw new Error(`Unknown fetcher for ${remote.type}`);

    await fs.mkdirp(dest);

    try {
      let fetcher = new Fetcher(remote, this.config, reference.saveForOffline);
      return await fetcher.fetch(dest);
    } catch (err) {
      try {
        //await fs.unlink(dest);
      } catch (err) {
        // what do?
      }
      throw err;
    }
  }

  async maybeFetch(reference: PackageReference): Promise<?FetchedManifest> {
    let promise = this.fetch(reference, false);

    if (reference.optional) {
      // swallow the error
      promise = promise.catch((err) => {
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
        return this.resolver.updateManifest(ref, res.package).then(function () {
          if (tick) tick(ref.name);
        });
      }
    }));
  }
}
