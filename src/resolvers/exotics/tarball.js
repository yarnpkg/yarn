/* @flow */

import type { PackageInfo } from "../../types";
import type PackageRequest from "../../package-request";
import queue from "../../util/blocking-queue"
import TarballFetcher from "../../fetchers/tarball";
import ExoticResolver from "./_base";
import Git from "./git";
import * as versionUtil from "../../util/version";
import * as crypto from "../../util/crypto";
import * as fs from "../../util/fs";

export default class TarballResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    let { hash, url } = versionUtil.explodeHashedUrl(fragment);
    this.hash = hash;
    this.url  = url;
  }

  url: string;
  hash: string;

  static isVersion(pattern: string): boolean {
    if (Git.isVersion(pattern)) return false; // we can sometimes match their urls

    return pattern.indexOf("http://") === 0 || pattern.indexOf("https://") === 0;
  }

  resolve(): Promise<PackageInfo> {
    let { url, hash } = this;

    let pkgJson;

    // generate temp directory
    let dest = this.config.getTemp(crypto.hash(url));

    return queue.push(dest, async () => {
      let shrunk = this.request.getShrunk("tarball");
      if (shrunk) return shrunk;

      let { registry } = this;

      if (await fs.isValidModuleDest(dest)) {
        let pkgRegistry;
        // load from local cache
        ({ package: pkgJson, hash, registry: pkgRegistry } = await fs.readPackageMetadata(dest));
        if (pkgRegistry !== registry) {
          throw new Error("This tarball is from a different registry...?");
        }
      } else {
        // delete if invalid
        await fs.unlink(dest);

        let fetcher = new TarballFetcher({
          type: "tarball",
          reference: url,
          registry,
          hash
        }, this.config);

        // fetch file and get it's hash
        let fetched = await fetcher.fetch(dest);
        pkgJson = fetched.package;
        hash    = fetched.hash;

        // $FlowFixMe: this is temporarily added on here so we can put it on the remote
        registry = pkgJson.registry;
      }

      // use the commit/tarball hash as the uid as we can't rely on the version as it's not
      // in the registry
      pkgJson.uid = hash;

      // set remote so it can be "fetched"
      pkgJson.remote = {
        type: "copy",
        resolved: `${url}#${hash}`,
        registry,
        reference: {
          src: dest,
          dest: this.config.generateHardModulePath({
            name: pkgJson.name,
            version: pkgJson.version,
            uid: hash,
            registry
          })
        }
      };

      //
      this.resolver.addTag(pkgJson.name, this.pattern, pkgJson.version);

      return pkgJson;
    });
  }
}
