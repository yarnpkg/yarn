/* @flow */

import type { PackageInfo } from "../../types";
import { MessageError } from "../../errors";
import * as constants from "../../constants";
import RegistryResolver from "./_base";
import GitResolver from "../exotics/git";

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

    let body = await this.requestManager.request(`${constants.BOWER_REGISTRY_URL}/packages/${this.name}`);
    if (body) {
      return this.fork(GitResolver, false, `${body.url}#${this.range}`);
    } else {
      throw new MessageError(`Couldn't find package ${this.name} on the bower registry`);
    }
  }
}
