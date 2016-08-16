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

import type { Manifest, FetchedManifest } from '../../types.js';
import type PackageRequest from '../../package-request.js';
import TarballFetcher from '../../fetchers/tarball.js';
import ExoticResolver from './_base.js';
import Git from './git.js';
import * as versionUtil from '../../util/version.js';
import * as crypto from '../../util/crypto.js';
import * as fs from '../../util/fs.js';

let _ = require('lodash');

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
    // we can sometimes match git urls which we don't want
    if (Git.isVersion(pattern)) {
      return false;
    }

    // full http url
    if (pattern.indexOf('http://') === 0 || pattern.indexOf('https://') === 0) {
      return true;
    }

    // local file reference
    if (_.endsWith(pattern, '.tgz') || _.endsWith(pattern, 'tar.gz')) {
      return true;
    }

    return false;
  }

  async resolve(): Promise<Manifest> {
    let shrunk = this.request.getLocked('tarball');
    if (shrunk) {
      return shrunk;
    }

    let { url, hash, registry } = this;
    let pkgJson;

    // generate temp directory
    let dest = this.config.getTemp(crypto.hash(url));

    if (await this.config.isValidModuleDest(dest)) {
      // load from local cache
      ({ package: pkgJson, hash, registry } = await this.config.readPackageMetadata(dest));
    } else {
      // delete if invalid
      await fs.unlink(dest);

      let fetcher = new TarballFetcher({
        type: 'tarball',
        reference: url,
        registry,
        hash,
      }, this.config, false);

      // fetch file and get it's hash
      let fetched: FetchedManifest = await fetcher.fetch(dest);
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
      type: 'copy',
      resolved: `${url}#${hash}`,
      hash,
      registry,
      reference: dest,
    };

    return pkgJson;
  }
}
