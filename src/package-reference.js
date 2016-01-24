/* @flow */

import type Lockfile from "./lockfile";
import type { PackageRemote, PackageInfo } from "./types";
import type { PackageRegistry } from "./resolvers";
import { getRegistryResolver } from "./resolvers";
import { MessageError } from "./errors";

export default class PackageReference {
  constructor(
    info: PackageInfo,
    remote: PackageRemote,
    deps: Array<string>,
    lockfile: Lockfile
  ) {
    this._lockfile = lockfile;

    this.registry = remote.registry;
    this.version  = info.version;
    this.name     = info.name;
    this.uid      = info.uid;

    this.remote = remote;

    this.dependencies = deps;

    this.permissions = {};
    this.patterns    = [];
    this.optional    = null;
  }

  _lockfile: Lockfile;

  name: string;
  version: string;
  uid: string;
  optional: ?boolean;
  dependencies: Array<string>;
  patterns: Array<string>;
  permissions: { [key: string]: boolean };
  remote: PackageRemote;
  registry: PackageRegistry;

  getFolder(): string {
    return getRegistryResolver(this.registry).directory;
  }

  setPermission(key: string, val: boolean) {
    this.permissions[key] = val;
  }

  hasPermission(key: string): boolean {
    if (key in this.permissions) {
      return this.permissions[key];
    } else {
      if (this._lockfile.isStrict()) {
        throw new MessageError(`Permission ${key} not found in permissions for ${this.name}@${this.version}`);
      } else {
        return false;
      }
    }
  }

  addPattern(pattern: string) {
    this.patterns.push(pattern);

    let shrunk = this._lockfile.getLocked(pattern);
    if (shrunk && shrunk.permissions) {
      for (let key in shrunk.permissions) {
        this.setPermission(key, shrunk.permissions[key]);
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
