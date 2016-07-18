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

import type Lockfile from "./lockfile/index.js";
import type Config from "./config.js";
import type { PackageRemote, Manifest } from "./types.js";
import type PackageRequest from "./package-request.js";
import type { RegistryNames } from "./registries/index.js";
import { entries } from "./util/misc.js";
import { MessageError } from "./errors.js";

export default class PackageReference {
  constructor(
    request: PackageRequest,
    info: Manifest,
    remote: PackageRemote,
    saveForOffline: boolean,
  ) {
    this.lockfile = request.rootLockfile;
    this.requests = [request];
    this.config   = request.config;

    this.registry = remote.registry;
    this.version  = info.version;
    this.name     = info.name;
    this.uid      = info.uid;

    this.remote = remote;

    this.dependencies = [];

    this.permissions = {};
    this.patterns    = [];
    this.optional    = null;
    this.ignore      = null;
    this.location    = null;
    this.saveForOffline = !!saveForOffline;
  }

  requests: Array<PackageRequest>;
  lockfile: Lockfile;
  config: Config;

  name: string;
  version: string;
  uid: string;
  optional: ?boolean;
  ignore: ?boolean;
  saveForOffline: boolean;
  dependencies: Array<string>;
  patterns: Array<string>;
  permissions: { [key: string]: boolean };
  remote: PackageRemote;
  registry: RegistryNames;
  location: ?string;

  async getFolder(): Promise<string> {
    return this.config.registries[this.registry].folder;
  }

  setLocation(loc: string): string {
    return this.location = loc;
  }

  addRequest(request: PackageRequest) {
    this.requests.push(request);
  }

  setDependencies(deps: Array<string>) {
    this.dependencies = deps;
  }

  setPermission(key: string, val: boolean) {
    this.permissions[key] = val;
  }

  hasPermission(key: string): boolean {
    if (key in this.permissions) {
      return this.permissions[key];
    } else {
      if (this.lockfile.isStrict()) {
        throw new MessageError(`Permission ${key} not found in permissions for ${this.name}@${this.version}`);
      } else {
        return false;
      }
    }
  }

  addPattern(pattern: string) {
    this.patterns.push(pattern);

    let shrunk = this.lockfile.getLocked(pattern);
    if (shrunk && shrunk.permissions) {
      for (let [key, perm] of entries(shrunk.permissions)) {
        this.setPermission(key, perm);
      }
    }
  }

  addOptional(optional: boolean) {
    if (this.optional == null) {
      // optional is uninitialised
      this.optional = optional;
    } else if (!optional) {
      // otherwise, ignore all subsequent optional assignments and only accept ones making
      // this not optional
      this.optional = false;
    }
  }

  addIgnore(ignore: boolean) {
    // see comments in addOptional
    if (this.ignore == null) {
      this.ignore = ignore;
    } else if (!ignore) {
      this.ignore = false;
    }
  }
}
