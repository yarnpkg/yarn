/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type PackageRequest from "../package-request.js";
import type PackageResolver from "../package-resolver.js";
import type { PackageInfo } from "../types.js";
import type { RegistryNames } from "../registries/index.js";
import type Reporter from "../reporters/_base.js";
import type Config from "../config.js";

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
