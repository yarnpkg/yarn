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
const _ = require('lodash');

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

    if (_.isPlainObject(info.engines)) {
      for (let [name, range] of entries(info.engines)) {
        if (aliases[name]) {
          name = aliases[name];
        }

        const actual = process.versions[name];
        if (actual) {
          if (!semver.satisfies(actual, range)) {
            pushError(this.reporter.lang('incompatibleEngine', name, range));
          }
        } else if (!_.includes(ignore, name)) {
          this.reporter.warn(`${human}: ${this.reporter.lang('invalidEngine', name)}`);
        }
      }
    }

    if (didError) {
      throw new MessageError(reporter.lang('foundIncompatible'));
    }
  }

  async init(): Promise<void> {
    const infos = this.resolver.getManifests();
    for (const info of infos) {
      this.check(info);
    }
  }
}
