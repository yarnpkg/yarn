/* @flow */

import type { PackageInfo } from "../../types";
import { MessageError } from "../../errors";
import RegistryResolver from "./_base";
import GitResolver from "../exotics/git";

export default class BowerResolver extends RegistryResolver {
  static registry = "bower";

  async resolve(): Promise<PackageInfo> {
    let body = await this.config.requestManager.request({
      url: `${this.registryConfig.registry}/packages/${this.name}`,
      json: true
    });

    if (body) {
      return this.fork(GitResolver, false, `${body.url}#${this.range}`);
    } else {
      throw new MessageError(`Couldn't find package ${this.name} on the bower registry`);
    }
  }
}
