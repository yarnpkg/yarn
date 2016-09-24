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

function isValid(items: Array<string>, actual: string): boolean {
  let isBlacklist = false;

  for (const item of items) {
    // whitelist
    if (item === actual) {
      return true;
    }

    // blacklist
    if (item[0] === '!') {
      // we're in a blacklist so anything that doesn't match this is fine to have
      isBlacklist = true;

      if (actual === item.slice(1)) {
        return false;
      }
    }
  }

  return isBlacklist;
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

export function testEngine(name: string, range: string, versions: Versions): boolean {
  const actual = versions[name];
  if (!actual) {
    return false;
  }

  if (semver.satisfies(actual, range)) {
    return true;
  }

  if (name === 'node' && semver.gt(actual, '1.0.0')) {
    // WARNING: this is a massive hack and is super gross but necessary for compatibility
    // some modules have the `engines.node` field set to a caret version below semver major v1
    // eg. ^0.12.0. this is problematic as we enforce engines checks and node is now on version >=1
    // to allow this pattern we transform the node version to fake ones in the minor range 10-13
    const major = semver.major(actual);
    const fakes = [
      `0.10.${major}`,
      `0.11.${major}`,
      `0.12.${major}`,
      `0.13.${major}`,
    ];
    for (const actualFake of fakes) {
      if (semver.satisfies(actualFake, range)) {
        return true;
      }
    }
  }

  // incompatible version
  return false;
}

export default class PackageCompatibility {
  constructor(config: Config, resolver: PackageResolver) {
    this.reporter = config.reporter;
    this.resolver = resolver;
    this.config = config;
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

    if (Array.isArray(info.os)) {
      if (!PackageCompatibility.isValidPlatform(info.os)) {
        pushError(this.reporter.lang('incompatibleOS', process.platform));
      }
    }

    if (Array.isArray(info.cpu)) {
      if (!PackageCompatibility.isValidArch(info.cpu)) {
        pushError(this.reporter.lang('incompatibleCPU', process.arch));
      }
    }

    if (!this.config.ignoreEngines && typeof info.engines === 'object') {
      for (let [name, range] of entries(info.engines)) {
        if (aliases[name]) {
          name = aliases[name];
        }

        if (process.versions[name]) {
          if (!testEngine(name, range, process.versions)) {
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
