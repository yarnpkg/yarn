/* @flow */

import type { PackageInfo } from "../../types";
import type PackageRequest from "../../package-request";
import ExoticResolver from "./_base";
import * as util from "../../util/misc";

export default class FileResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);
    this.loc = util.removePrefix(fragment, "file:");
  }

  loc: string;

  // $FlowFixMe: i know what i'm doing
  static protocol = "file";

  resolve(): Promise<PackageInfo> {
    throw new Error("TODO " + this.loc);
  }
}
