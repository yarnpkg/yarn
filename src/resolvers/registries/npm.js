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

import type { Manifest } from "../../types.js";
import { MessageError } from "../../errors.js";
import RegistryResolver from "./_base.js";
import { queue } from "../../util/promise.js";

type RegistryResponse = {
  name: string,
  versions: { [key: string]: Manifest },
  "dist-tags": { [key: string]: string },
};

export default class NpmResolver extends RegistryResolver {
  static registry = "npm";

  async findVersionInRegistryResponse(body: RegistryResponse): Promise<Manifest> {
    let range = this.range;

    if (range in body["dist-tags"]) {
      range = body["dist-tags"][range];
    }

    let satisfied = await this.config.resolveConstraints(Object.keys(body.versions), range);
    if (satisfied) {
      return body.versions[satisfied];
    } else {
      throw new MessageError(
        `Couldn't find any versions for ${body.name} that matches ${range}. ` +
        `Possible versions: ${Object.keys(body.versions).join(", ")}`
      );
    }
  }

  async warmCache(): Promise<void> {
    let res = await this.resolveRequest();
    if (!res || !res.dependencies) return;

    let resolvers = [];

    for (let [name, range] of Object.entries(res.dependencies)) {
      resolvers.push(new NpmResolver(this.request, name, range));
    }

    await queue(resolvers, (resolver) => resolver.warmCache(), 5);
  }

  async resolveRequest(): Promise<false | RegistryResponse> {
    return await this.config.requestManager.request({
      url: `${this.registryConfig.registry}/${this.name}/${this.range}`,
      json: true
    });
  }

  async resolve(): Promise<Manifest> {
    // lockfile
    let shrunk = this.request.getLocked("tarball");
    if (shrunk) return shrunk;

    let info = await this.resolveRequest();

    if (!info) {
      throw new MessageError(
        `Couldn't find package ${this.name} on the npm registry. ${this.request.getHuman()}`
      );
    }

    if (info.dist && info.dist.tarball) {
      info.remote = {
        resolved: `${info.dist.tarball}#${info.dist.shasum}`,
        type: "tarball",
        reference: info.dist.tarball,
        hash: info.dist.shasum,
        registry: "npm"
      };
    }

    info.uid = info.version;
    return info;
  }
}
