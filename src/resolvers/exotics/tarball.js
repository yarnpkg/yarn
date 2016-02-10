/* @flow */

import type { PackageInfo, FetchedPackageInfo } from "../../types.js";
import type PackageRequest from "../../package-request.js";
import TarballFetcher from "../../fetchers/tarball.js";
import ExoticResolver from "./_base.js";
import Git from "./git.js";
import * as versionUtil from "../../util/version.js";
import * as crypto from "../../util/crypto.js";
import * as fs from "../../util/fs.js";

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

  async resolve(): Promise<PackageInfo> {
    let shrunk = this.request.getLocked("tarball");
    if (shrunk) return shrunk;

    let { url, hash, registry } = this;
    let pkgJson;

    // generate temp directory
    let dest = this.config.getTemp(crypto.hash(url));

    if (await fs.isValidModuleDest(dest)) {
      // load from local cache
      ({ package: pkgJson, hash, registry } = await fs.readPackageMetadata(dest));
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
      let fetched: FetchedPackageInfo = await fetcher.fetch(dest);
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

    return pkgJson;
  }
}
