/* @flow */

import type { PackageInfo } from "../../types";
import type PackageRequest from "../../package-request";
import { MessageError } from "../../errors";
import ExoticResolver from "./_base";

export default class RegistryResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    let match = fragment.match(/^(\S+):(.*?)(@(.*?)|)$/);
    if (match) {
      this.range = match[4] || "latest";
      this.name  = match[2];
    } else {
      throw new MessageError(`Invalid fragment ${fragment}`);
    }

    // $FlowFixMe: make flow understand this, somehow...
    this.registry = this.constructor.protocol;
  }

  name: string;
  range: string;
  factory: Function;

  resolve(): Promise<PackageInfo> {
    // $FlowFixMe: make flow understand this somehow...
    return this.fork(this.constructor.factory, false, this.name, this.range);
  }
}
