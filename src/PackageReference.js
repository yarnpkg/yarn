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

import type Lockfile from './lockfile/Lockfile.js';
import type Config from './config.js';
import type {PackageRemote, Manifest} from './types.js';
import type PackageRequest from './PackageRequest.js';
import type PackageResolver from './PackageResolver.js';
import type {RegistryNames} from './registries/index.js';
import {entries} from './util/misc.js';
import {MessageError} from './errors.js';

const invariant = require('invariant');

export default class PackageReference {
  constructor(
    request: PackageRequest,
    info: Manifest,
    remote: PackageRemote,
    saveForOffline: boolean,
  ) {
    this.resolver = request.resolver;
    this.lockfile = request.lockfile;
    this.requests = [request];
    this.config = request.config;

    this.registry = remote.registry;
    this.version = info.version;
    this.name = info.name;
    this.uid = info._uid;

    this.remote = remote;

    this.dependencies = [];

    this.permissions = {};
    this.patterns = [];
    this.optional = null;
    this.ignore = null;
    this.fresh = false;
    this.location = null;
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
  fresh: boolean;
  saveForOffline: boolean;
  dependencies: Array<string>;
  patterns: Array<string>;
  permissions: { [key: string]: boolean };
  remote: PackageRemote;
  registry: RegistryNames;
  location: ?string;
  resolver: PackageResolver;

  setFresh(fresh: boolean) {
    this.fresh = fresh;
  }

  setLocation(loc: string): string {
    return this.location = loc;
  }

  addRequest(request: PackageRequest) {
    this.requests.push(request);
  }

  addDependencies(deps: Array<string>) {
    this.dependencies = this.dependencies.concat(deps);
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

    const shrunk = this.lockfile.getLocked(pattern);
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

  addIgnore(ignore: boolean, ancestry?: Set<PackageReference> = new Set()) {
    // see comments in addOptional
    if (this.ignore == null) {
      this.ignore = ignore;
    } else if (!ignore) {
      this.ignore = false;
    } else {
      // we haven't changed our `ignore` so don't mess with
      // dependencies
      return;
    }

    if (ancestry.has(this)) {
      return;
    }
    ancestry.add(this);

    // go through and update all transitive dependencies to be ignored
    for (const pattern of this.dependencies) {
      const pkg = this.resolver.getResolvedPattern(pattern);
      if (!pkg) {
        continue;
      }

      const ref = pkg._reference;
      invariant(ref, 'expected package reference');
      ref.addIgnore(ignore, ancestry);
    }
  }
}
