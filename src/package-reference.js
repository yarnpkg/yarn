/* @flow */

import type Lockfile from "./lockfile";
import type Config from "./config";
import type { PackageRemote, PackageInfo } from "./types";
import type { RegistryNames } from "./registries";
import { MessageError } from "./errors";

export default class PackageReference {
  constructor(
    info: PackageInfo,
    remote: PackageRemote,
    deps: Array<string>,
    lockfile: Lockfile,
    config: Config
  ) {
    this.lockfile = lockfile;
    this.config   = config;

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

  lockfile: Lockfile;
  config: Config;

  name: string;
  version: string;
  uid: string;
  optional: ?boolean;
  dependencies: Array<string>;
  patterns: Array<string>;
  permissions: { [key: string]: boolean };
  remote: PackageRemote;
  registry: RegistryNames;

  async getFolder(): Promise<string> {
    return this.config.registries[this.registry].loc;
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
