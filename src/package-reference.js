/* @flow */

import type Lockfile from './lockfile/wrapper.js';
import type Config from './config.js';
import type {PackageRemote, Manifest} from './types.js';
import type PackageRequest from './package-request.js';
import type PackageResolver from './package-resolver.js';
import type {RegistryNames} from './registries/index.js';
import {entries} from './util/misc.js';

export default class PackageReference {
  constructor(
    request: PackageRequest,
    info: Manifest,
    remote: PackageRemote,
  ) {
    this.resolver = request.resolver;
    this.lockfile = request.lockfile;
    this.requests = [];
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
    this.root = false;
    this.ignore = false;
    this.incompatible = false;
    this.fresh = false;
    this.location = null;
    this.addRequest(request);
  }

  requests: Array<PackageRequest>;
  lockfile: Lockfile;
  config: Config;

  root: boolean;
  name: string;
  version: string;
  uid: string;
  optional: ?boolean;
  ignore: boolean;
  incompatible: boolean;
  fresh: boolean;
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

    if (!request.parentRequest) {
      this.root = true;
    }
  }

  prune() {
    for (const selfPattern of this.patterns) {
      // remove ourselves from the resolver
      this.resolver.removePattern(selfPattern);
    }
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
      return false;
    }
  }

  addPattern(pattern: string, manifest: Manifest) {
    this.resolver.addPattern(pattern, manifest);

    this.patterns.push(pattern);

    const shrunk = this.lockfile.getLocked(pattern);
    if (shrunk && shrunk.permissions) {
      for (const [key, perm] of entries(shrunk.permissions)) {
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
}
