/* @flow */

import type { PackageInfo } from "../../types";
import { MessageError } from "../../errors";
import RegistryResolver from "./_base";
import GitResolver from "../exotics/git";

const BOWER_REGISTRY_URL = "https://bower.herokuapp.com";

export default class BowerResolver extends RegistryResolver {
  // $FlowFixMe: i know what i'm doing
  static alwaysFlatten = true;

  // $FlowFixMe: i know what i'm doing
  static directory = "bower_components";

  // $FlowFixMe: i know what i'm doing
  static filename = "bower.json";

  static async getConfig(cwd: string): Promise<Object> {
    // TODO
    cwd;
    return {};
  }

  async resolve(): Promise<PackageInfo> {
    // let config = await this.config.getRegistryConfig("bower");

    let body = await this.requestManager.request(`${BOWER_REGISTRY_URL}/packages/${this.name}`);
    if (body) {
      return this.fork(GitResolver, false, `${body.url}#${this.range}`);
    } else {
      throw new MessageError(`Couldn't find package ${this.name} on the bower registry`);
    }
  }
}
