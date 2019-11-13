/* @flow */

import type {Manifest} from './types.js';
import type Config from './config.js';
import {MessageError} from './errors.js';
import map from './util/map.js';
import {entries} from './util/misc.js';
import {version as yarnVersion} from './util/yarn-version.js';
import {satisfiesWithPrereleases} from './util/semver.js';

const semver = require('semver');

const VERSIONS = Object.assign({}, process.versions, {
  yarn: yarnVersion,
});

type PartialManifest = $Shape<Manifest>;

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
  'rhino', // once a target for older modules
  'cordovaDependencies', // http://bit.ly/2tkUePg
  'parcel', // used for plugins of the Parcel bundler
];

type Versions = {
  [engineName: string]: ?string,
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

  if (name === 'yarn' && satisfiesWithPrereleases(actual, range, looseSemver)) {
    return true;
  }

  if (name === 'node' && semver.gt(actual, '1.0.0', looseSemver)) {
    // WARNING: this is a massive hack and is super gross but necessary for compatibility
    // some modules have the `engines.node` field set to a caret version below semver major v1
    // eg. ^0.12.0. this is problematic as we enforce engines checks and node is now on version >=1
    // to allow this pattern we transform the node version to fake ones in the minor range 10-13
    const major = semver.major(actual, looseSemver);
    const fakes = [`0.10.${major}`, `0.11.${major}`, `0.12.${major}`, `0.13.${major}`];
    for (const actualFake of fakes) {
      if (semver.satisfies(actualFake, range, looseSemver)) {
        return true;
      }
    }
  }

  // incompatible version
  return false;
}

function isValidArch(archs: Array<string>): boolean {
  return isValid(archs, process.arch);
}

function isValidPlatform(platforms: Array<string>): boolean {
  return isValid(platforms, process.platform);
}

export function checkOne(info: Manifest, config: Config, ignoreEngines: boolean) {
  let didIgnore = false;
  let didError = false;
  const reporter = config.reporter;
  const human = `${info.name}@${info.version}`;

  const pushError = msg => {
    const ref = info._reference;

    if (ref && ref.optional) {
      ref.ignore = true;
      ref.incompatible = true;

      reporter.info(`${human}: ${msg}`);
      if (!didIgnore) {
        reporter.info(reporter.lang('optionalCompatibilityExcluded', human));
        didIgnore = true;
      }
    } else {
      reporter.error(`${human}: ${msg}`);
      didError = true;
    }
  };

  const {os, cpu, engines} = info;

  if (shouldCheckPlatform(os, config.ignorePlatform) && !isValidPlatform(os)) {
    pushError(reporter.lang('incompatibleOS', process.platform));
  }

  if (shouldCheckCpu(cpu, config.ignorePlatform) && !isValidArch(cpu)) {
    pushError(reporter.lang('incompatibleCPU', process.arch));
  }

  if (shouldCheckEngines(engines, ignoreEngines)) {
    for (const entry of entries(info.engines)) {
      let name = entry[0];
      const range = entry[1];

      if (aliases[name]) {
        name = aliases[name];
      }

      if (VERSIONS[name]) {
        if (!testEngine(name, range, VERSIONS, config.looseSemver)) {
          pushError(reporter.lang('incompatibleEngine', name, range, VERSIONS[name]));
        }
      } else if (ignore.indexOf(name) < 0) {
        reporter.warn(`${human}: ${reporter.lang('invalidEngine', name)}`);
      }
    }
  }

  if (didError) {
    throw new MessageError(reporter.lang('foundIncompatible'));
  }
}

export function check(infos: Array<Manifest>, config: Config, ignoreEngines: boolean) {
  for (const info of infos) {
    checkOne(info, config, ignoreEngines);
  }
}

function shouldCheckCpu(cpu: $PropertyType<Manifest, 'cpu'>, ignorePlatform: boolean): boolean %checks {
  return !ignorePlatform && Array.isArray(cpu) && cpu.length > 0;
}

function shouldCheckPlatform(os: $PropertyType<Manifest, 'os'>, ignorePlatform: boolean): boolean %checks {
  return !ignorePlatform && Array.isArray(os) && os.length > 0;
}

function shouldCheckEngines(engines: $PropertyType<Manifest, 'engines'>, ignoreEngines: boolean): boolean %checks {
  return !ignoreEngines && typeof engines === 'object';
}

export function shouldCheck(
  manifest: PartialManifest,
  options: {ignoreEngines: boolean, ignorePlatform: boolean},
): boolean {
  return (
    shouldCheckCpu(manifest.cpu, options.ignorePlatform) ||
    shouldCheckPlatform(manifest.os, options.ignorePlatform) ||
    shouldCheckEngines(manifest.engines, options.ignoreEngines)
  );
}
