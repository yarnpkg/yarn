/* @flow */

import type { PackageInfo } from "../../types.js";
import type PackageRequest from "../../package-request.js";
import ExoticResolver from "./_base.js";
import * as util from "../../util/misc.js";

export default class FileResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);
    this.loc = util.removePrefix(fragment, "file:");
  }

  loc: string;

  static protocol = "file";

  resolve(): Promise<PackageInfo> {
    throw new Error("TODO " + this.loc);
  }
}
