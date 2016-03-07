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

import type PackageResolver from "./package-resolver.js";
import type { Reporter } from "kreporters";
import type { Manifest } from "./types.js";
import type Config from "./config.js";
import { BailError } from "./errors.js";
import map from "./util/map.js";

let semver = require("semver");
let _      = require("lodash");

function isValid(items: Array<string>, actual: string): boolean {
  let isBlacklist = false;

  for (let item of items) {
    // whitelist
    if (item === actual) {
      return true;
    }

    // blacklist
    if (item[0] === "!") {
      // we're in a blacklist so anything that doesn't match this is fine to have
      isBlacklist = true;

      if (actual === item.slice(1)) {
        return false;
      }
    }
  }

  return isBlacklist;
}

let aliases = map({
  iojs: "node" // we should probably prompt these libraries to fix this
});

let ignore = [
  "npm" // we'll never satisfy this for obvious reasons
];

export default class PackageCompatibility {
  constructor(config: Config, resolver: PackageResolver) {
    this.reporter = config.reporter;
    this.resolver = resolver;
    this.config   = config;
  }

  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;

  static isValidArch(archs: Array<string>): boolean {
    return isValid(archs, process.arch);
  }

  static isValidPlatform(platforms: Array<string>): boolean {
    return isValid(platforms, process.platform);
  }

  check(info: Manifest) {
    let didError = false;
    let human    = `${info.name}@${info.version}`;

    let pushError = (msg) => {
      didError = true;
      this.reporter.error(`${human}: ${msg}`);
    };

    if (Array.isArray(info.os)) {
      if (!PackageCompatibility.isValidPlatform(info.os)) {
        pushError(`The platform ${process.platform} is incompatible with this module.`);
      }
    }

    if (Array.isArray(info.cpu)) {
      if (!PackageCompatibility.isValidArch(info.cpu)) {
        pushError(`The CPU architecture ${process.arch} is incompatible with this module.`);
      }
    }

    if (_.isPlainObject(info.engines)) {
      for (let [name, range] of Object.entries(info.engines)) {
        if (aliases[name]) {
          name = aliases[name];
        }

        if (_.has(process.versions, name)) {
          let actual = process.versions[name];
          if (!semver.satisfies(actual, range)) {
            pushError(`The engine ${name} is incompatible with this module. Expected version ${range}.`);
          }
        } else if (!_.includes(ignore, name)) {
          // TODO: this causes a lot of warnings
          //this.reporter.warn(`${human}: The engine ${name} appears to be invalid.`);
        }
      }
    }

    if (didError) throw BailError;
  }

  async init(): Promise<void> {
    let infos  = this.resolver.getManifests();
    for (let info of infos) {
      this.check(info);
    }
  }
}
