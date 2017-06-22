/* @flow */

import type {Manifest, FetchedMetadata} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import TarballFetcher from '../../fetchers/tarball-fetcher.js';
import ExoticResolver from './exotic-resolver.js';
import Git from './git-resolver.js';
import {removePrefix} from '../../util/misc.js';
import guessName from '../../util/guess-name.js';
import * as versionUtil from '../../util/version.js';
import * as crypto from '../../util/crypto.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');

export default class TarballResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const {hash, url} = versionUtil.explodeHashedUrl(fragment);
    this.hash = hash;
    this.url = url;
  }

  url: string;
  hash: string;

  static isVersion(pattern: string): boolean {
    // we can sometimes match git urls which we don't want
    if (Git.isVersion(pattern)) {
      return false;
    }

    // full http url
    if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
      return true;
    }

    // local file reference - ignore patterns with names
    if (pattern.indexOf('@') < 0) {
      if (pattern.endsWith('.tgz') || pattern.endsWith('.tar.gz')) {
        return true;
      }
    }

    return false;
  }

  async resolve(): Promise<Manifest> {
    const shrunk = this.request.getLocked('tarball');
    if (shrunk) {
      return shrunk;
    }

    const url = removePrefix(this.url, 'file:');
    let {hash, registry} = this;
    let pkgJson;

    // generate temp directory
    const dest = this.config.getTemp(crypto.hash(url));

    if (await this.config.isValidModuleDest(dest)) {
      // load from local cache
      ({package: pkgJson, hash, registry} = await this.config.readPackageMetadata(dest));
    } else {
      // delete if invalid
      await fs.unlink(dest);

      const fetcher = new TarballFetcher(
        dest,
        {
          type: 'tarball',
          reference: url,
          registry,
          hash,
        },
        this.config,
      );

      // fetch file and get it's hash
      const fetched: FetchedMetadata = await fetcher.fetch({
        name: guessName(url),
        version: '0.0.0',
        _registry: 'npm',
      });
      pkgJson = fetched.package;
      hash = fetched.hash;

      registry = pkgJson._registry;
      invariant(registry, 'expected registry');
    }

    // use the commit/tarball hash as the uid as we can't rely on the version as it's not
    // in the registry
    pkgJson._uid = hash;

    // set remote so it can be "fetched"
    pkgJson._remote = {
      type: 'copy',
      resolved: `${url}#${hash}`,
      hash,
      registry,
      reference: dest,
    };

    return pkgJson;
  }
}
