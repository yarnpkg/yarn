/* @flow */

import type PackageRequest from "../package-request";
import type PackageResolver from "../package-resolver";
import type { PackageInfo } from "../types";
import type { RegistryNames } from "../registries";
import type Reporter from "../reporters/_base";
import type Config from "../config";

export default class BaseResolver {
  constructor(request: PackageRequest, fragment: string) {
    this.resolver = request.resolver;
    this.reporter = request.reporter;
    this.fragment = fragment;
    this.registry = request.registry;
    this.request  = request;
    this.pattern  = request.pattern;
    this.config   = request.config;
  }

  resolver: PackageResolver;
  reporter: Reporter;
  fragment: string;
  request: PackageRequest;
  pattern: string;
  config: Config;
  registry: RegistryNames;

  async fork(Resolver: Function, resolveArg: any, ...args: Array<string>): Promise {
    let resolver = new Resolver(this.request, ...args);
    resolver.registry = this.registry;
    return resolver.resolve(resolveArg);
  }

  resolve(): Promise<PackageInfo> {
    throw new Error("Not implemented");
  }
}
