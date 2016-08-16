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

import type { Manifest } from '../../types.js';
import { MessageError } from '../../errors.js';
import RegistryResolver from './_base.js';
import { queue } from '../../util/promise.js';
import { entries, removeSuffix } from '../../util/misc.js';
import map from '../../util/map.js';
import * as fs from '../../util/fs.js';

let invariant = require('invariant');
let path = require('path');

type RegistryResponse = {
  name: string,
  versions: { [key: string]: Manifest },
  "dist-tags": { [key: string]: string },
};

export default class NpmResolver extends RegistryResolver {
  static registry = 'npm';

  async findVersionInRegistryResponse(body: RegistryResponse): Promise<Manifest> {
    let range = this.range;

    if (range in body['dist-tags']) {
      range = body['dist-tags'][range];
    }

    let satisfied = await this.config.resolveConstraints(Object.keys(body.versions), range);
    if (satisfied) {
      return body.versions[satisfied];
    } else {
      throw new MessageError(
        `Couldn't find any versions for ${body.name} that matches ${range}. ` +
        `Possible versions: ${Object.keys(body.versions).join(', ')}`
      );
    }
  }

  async warmCache(): Promise<void> {
    let res = await this.resolveRequest();
    if (!res || !res.dependencies) {
      return;
    }

    queue;
    entries;
    /*let resolvers = [];

    for (let [name, range] of entries(res.dependencies)) {
      resolvers.push(new NpmResolver(this.request, name, range));
    }

    await queue(resolvers, (resolver) => resolver.warmCache(), 5);*/
  }

  async resolveRequest(): Promise<false | Manifest> {
    if (this.config.offline) {
      return this.resolveRequestOffline();
    }

    let registry = removeSuffix(this.registryConfig.registry, '/');

    let name = this.name;

    // scoped packages contain slashes and the npm registry expects them to be escaped
    name = name.replace('/', '%2F');

    let body = await this.config.requestManager.request({
      url: `${registry}/${name}`,
      json: true,
    });

    if (body) {
      return await this.findVersionInRegistryResponse(body);
    } else {
      return false;
    }
  }

  async resolveRequestOffline(): Promise<false | Manifest> {
    // find modules of this name
    let prefix = `npm-${this.name}-`;

    let packagesRoot = this.config.packagesRoot;
    invariant(packagesRoot, 'expected packages root');

    let files = await this.config.getCache('cachedPackages', async (): Promise<Array<string>> => {
      invariant(packagesRoot, 'expected packages root');
      let files = await fs.readdir(packagesRoot);
      let validFiles = [];

      for (let name of files) {
        // no hidden files
        if (name[0] === '.') {
          continue;
        }

        // ensure valid module cache
        let dir = path.join(packagesRoot, name);
        if (await this.config.isValidModuleDest(dir)) {
          validFiles.push(name);
        }
      }

      return validFiles;
    });

    let versions = map();

    for (let name of files) {
      // check if folder starts with our prefix
      if (name.indexOf(prefix) !== 0) {
        continue;
      }

      let dir = path.join(packagesRoot, name);

      // read manifest and validate correct name
      let pkg = await this.config.readManifest(dir, 'npm');
      if (pkg.name !== this.name) {
        continue;
      }

      // read package metadata
      let metadata = await this.config.readPackageMetadata(dir);
      if (!metadata.remote) {
        continue; // old kpm metadata
      }

      versions[pkg.version] = Object.assign({}, pkg, { remote: metadata.remote });
    }

    let satisfied = await this.config.resolveConstraints(Object.keys(versions), this.range);
    if (satisfied) {
      return versions[satisfied];
    } else {
      throw new MessageError(
        `Couldn't find any versions for ${this.name} that matches ${this.range} in our cache. ` +
        `Possible versions: ${Object.keys(versions).join(', ')} ${prefix}`
      );
    }
  }

  async resolve(): Promise<Manifest> {
    // lockfile
    let shrunk = this.request.getLocked('tarball');
    if (shrunk) {
      return shrunk;
    }

    let info = await this.resolveRequest();

    if (!info) {
      throw new MessageError(
        `Couldn't find package ${this.name} on the npm registry. ${this.request.getHuman()}`
      );
    }

    if (info.deprecated) {
      let name = info.name; // TODO verbose this.request.getHuman();
      this.reporter.warn(`${name}@${info.version}: ${info.deprecated}`);
    }

    if (info.dist && info.dist.tarball) {
      info.remote = {
        resolved: `${info.dist.tarball}#${info.dist.shasum}`,
        type: 'tarball',
        reference: info.dist.tarball,
        hash: info.dist.shasum,
        registry: 'npm',
      };
    }

    info.uid = info.version;
    return info;
  }
}
