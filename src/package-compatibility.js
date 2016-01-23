/* @flow */

import type PackageResolver from "./package-resolver";
import type Reporter from "./reporters/_base";
import type { PackageInfo } from "./types";
import type Config from "./config";
import { BailError } from "./errors";

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

export default class PackageCompatibility {
  constructor(config: Config, reporter: Reporter, resolver: PackageResolver) {
    this.reporter = reporter;
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

  check(info: PackageInfo) {
    let didError = false;
    let human    = `${info.name}@${info.version}`;

    let printError = (msg) => {
      didError = true;
      this.reporter.error(`${human}: ${msg}`);
    };

    if (Array.isArray(info.os)) {
      if (!PackageCompatibility.isValidPlatform(info.os)) {
        printError(`The platform ${process.platform} is incompatible with this module.`);
      }
    }

    if (Array.isArray(info.cpu)) {
      if (!PackageCompatibility.isValidArch(info.cpu)) {
        printError(`The CPU architecture ${process.arch} is incompatible with this module.`);
      }
    }

    if (_.isPlainObject(info.engines)) {
      for (let name in info.engines) {
        let range = info.engines[name];

        if (_.has(process.versions, name)) {
          let actual = process.versions[name];
          if (!semver.satisfies(actual, range)) {
            printError(`The engine ${name} is incompatible with this module. Expected version ${range}.`);
          }
        } else {
          // TODO: sam make this pretty or something idk - seb
          this.reporter.warn(`${human}: The engine ${name} appears to be invalid.`);
        }
      }
    }

    if (didError) throw BailError;
  }

  async init(): Promise<void> {
    let infos  = this.resolver.getPackageInfos();
    for (let info of infos) {
      this.check(info);
    }
  }
}
