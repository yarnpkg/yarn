/* @flow */

import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type {Manifest} from './types.js';
import type Config from './config.js';
import * as PackageReference from './package-reference.js';
import {MessageError} from './errors.js';
import map from './util/map.js';
import {entries} from './util/misc.js';

const invariant = require('invariant');
const semver = require('semver');

const VERSIONS = Object.assign({}, process.versions, {
  yarn: require('../package.json').version,
});

function isValid(items: Array<string>, actual: string): boolean {
  let isNotWhitelist = true;
  let isBlacklist = false;

  for (const item of items) {
    // blacklist
    if (item[0] === '!') {
      isBlacklist = true;

      if (actual === item.slice(1)) {
        return false;
      }
    // whitelist
    } else {
      isNotWhitelist = false;

      if (item === actual) {
        return true;
      }
    }
  }

  // npm allows blacklists and whitelists to be mixed. Blacklists with
  // whitelisted items should be treated as whitelists.
  return isBlacklist && isNotWhitelist;
}

const aliases = map({
  iojs: 'node', // we should probably prompt these libraries to fix this
});

const ignore = [
  'npm', // we'll never satisfy this for obvious reasons
  'teleport', // a module bundler used by some modules
];

type Versions = {
  [engineName: string]: ?string
};

export function testEngine(name: string, range: string, versions: Versions, looseSemver: boolean): boolean {
  const actual = versions[name];
  if (!actual) {
    return false;
  }

  if (!semver.valid(actual, looseSemver)) {
    return false;
  }

  if (semver.satisfies(actual, range, looseSemver)) {
    return true;
  }

  if (name === 'node' && semver.gt(actual, '1.0.0', looseSemver)) {
    // WARNING: this is a massive hack and is super gross but necessary for compatibility
    // some modules have the `engines.node` field set to a caret version below semver major v1
    // eg. ^0.12.0. this is problematic as we enforce engines checks and node is now on version >=1
    // to allow this pattern we transform the node version to fake ones in the minor range 10-13
    const major = semver.major(actual, looseSemver);
    const fakes = [
      `0.10.${major}`,
      `0.11.${major}`,
      `0.12.${major}`,
      `0.13.${major}`,
    ];
    for (const actualFake of fakes) {
      if (semver.satisfies(actualFake, range, looseSemver)) {
        return true;
      }
    }
  }

  // incompatible version
  return false;
}

export default class PackageCompatibility {
  constructor(config: Config, resolver: PackageResolver, ignoreEngines: boolean) {
    this.reporter = config.reporter;
    this.resolver = resolver;
    this.config = config;
    this.ignoreEngines = ignoreEngines;
  }

  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;
  ignoreEngines: boolean;

  static isValidArch(archs: Array<string>): boolean {
    return isValid(archs, process.arch);
  }

  static isValidPlatform(platforms: Array<string>): boolean {
    return isValid(platforms, process.platform);
  }

  check(info: Manifest) {
    let didIgnore = false;
    let didError = false;
    const reporter = this.reporter;
    const human = `${info.name}@${info.version}`;

    const pushError = (msg) => {
      const ref = info._reference;
      invariant(ref, 'expected package reference');

      if (ref.optional) {
        ref.addVisibility(PackageReference.ENVIRONMENT_IGNORE);

        reporter.warn(`${human}: ${msg}`);
        if (!didIgnore) {
          reporter.info(reporter.lang('optionalCompatibilityExcluded', human));
          didIgnore = true;
        }
      } else {
        reporter.error(`${human}: ${msg}`);
        didError = true;
      }
    };

    if (!this.config.ignorePlatform && Array.isArray(info.os)) {
      if (!PackageCompatibility.isValidPlatform(info.os)) {
        pushError(this.reporter.lang('incompatibleOS', process.platform));
      }
    }

    if (!this.config.ignorePlatform && Array.isArray(info.cpu)) {
      if (!PackageCompatibility.isValidArch(info.cpu)) {
        pushError(this.reporter.lang('incompatibleCPU', process.arch));
      }
    }

    if (!this.ignoreEngines && typeof info.engines === 'object') {
      for (const entry of entries(info.engines)) {
        let name = entry[0];
        const range = entry[1];

        if (aliases[name]) {
          name = aliases[name];
        }

        if (VERSIONS[name]) {
          if (!testEngine(name, range, VERSIONS, this.config.looseSemver)) {
            pushError(this.reporter.lang('incompatibleEngine', name, range));
          }
        } else if (ignore.indexOf(name) < 0) {
          this.reporter.warn(`${human}: ${this.reporter.lang('invalidEngine', name)}`);
        }
      }
    }

    if (didError) {
      throw new MessageError(reporter.lang('foundIncompatible'));
    }
  }

  init(): Promise<void> {
    const infos = this.resolver.getManifests();
    for (const info of infos) {
      this.check(info);
    }
    return Promise.resolve();
  }
}
