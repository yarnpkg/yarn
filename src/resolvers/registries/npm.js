/* @flow */

import type { PackageInfo } from "../../types";
import { MessageError } from "../../errors";
import RegistryResolver from "./_base";

const NPM_REGISTRY_URL = "https://registry.npmjs.org";

export default class NpmResolver extends RegistryResolver {
  static directory = "node_modules";
  static filename = "package.json";

  static async getConfig(cwd: string): Promise<Object> {
    // TODO
    cwd;
    return {};
  }

  async findVersionInRegistryResponse(body: {
    name: string,
    versions: { [key: string]: PackageInfo },
    "dist-tags": { [key: string]: string },
  }): Promise<PackageInfo> {
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

  async resolve(): Promise<PackageInfo> {
    // lockfile
    let shrunk = this.request.getLocked("tarball");
    if (shrunk) return shrunk;

    // let config = await this.config.getRegistryConfig("npm");

    let body = await this.config.requestManager.request({
      url: `${NPM_REGISTRY_URL}/${this.name}`,
      json: true
    });
    if (!body) {
      throw new MessageError(
        `Couldn't find package ${this.name} on the npm registry. ${this.request.getHuman()}`
      );
    }

    let info = await this.findVersionInRegistryResponse(body);

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
