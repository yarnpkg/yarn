/* @flow */

import type PackageRequest from "../../package-request";
import type { RegistryNames } from "../../registries";
import BaseResolver from "../_base";

export default class RegistryResolver extends BaseResolver {
  constructor(request: PackageRequest, name: string, range: string) {
    super(request, `${name}@${range}`);
    this.name  = name;
    this.range = range;

    this.registryConfig = request.config.registries[this.constructor.registry].config;
  }

  name: string;
  range: string;

  static registry: RegistryNames;
  registryConfig: Object;
}
