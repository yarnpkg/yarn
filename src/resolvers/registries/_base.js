/* @flow */

import type PackageRequest from "../../package-request";
import BaseResolver from "../_base";

export default class RegistryResolver extends BaseResolver {
  constructor(request: PackageRequest, name: string, range: string) {
    super(request, `${name}@${range}`);
    this.name  = name;
    this.range = range;
  }

  name: string;
  range: string;
}
