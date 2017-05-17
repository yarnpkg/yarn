/* @flow */

import type {Reporter} from '../reporters/index.js';
import type {Manifest} from '../types.js';
import type {RegistryNames} from '../registries/index.js';
import {sortAlpha} from '../util/misc.js';
import PackageRequest from '../package-request.js';
import parse from './parse.js';
import * as constants from '../constants.js';
import * as fs from '../util/fs.js';

const invariant = require('invariant');
const path = require('path');

export {default as parse} from './parse';
export {default as stringify} from './stringify';

type Dependencies = {
  [key: string]: string,
};

export type LockManifest = {
  name: string,
  version: string,
  resolved: string,
  registry: RegistryNames,
  uid: string,
  permissions: ?{[key: string]: boolean},
  optionalDependencies: ?Dependencies,
  dependencies: ?Dependencies,
};

type MinimalLockManifest = {
  name: ?string,
  version: string,
  resolved: string,
  registry: ?RegistryNames,
  uid: ?string,
  permissions: ?{[key: string]: boolean},
  optionalDependencies: ?Dependencies,
  dependencies: ?Dependencies,
};

function getName(pattern: string): string {
  return PackageRequest.normalizePattern(pattern).name;
}

function blankObjectUndefined(obj: ?Object): ?Object {
  return obj && Object.keys(obj).length ? obj : undefined;
}

export function implodeEntry(pattern: string, obj: Object): MinimalLockManifest {
  const inferredName = getName(pattern);
  return {
    name: inferredName === obj.name ? undefined : obj.name,
    version: obj.version,
    uid: obj.uid === obj.version ? undefined : obj.uid,
    resolved: obj.resolved,
    registry: obj.registry === 'npm' ? undefined : obj.registry,
    dependencies: blankObjectUndefined(obj.dependencies),
    optionalDependencies: blankObjectUndefined(obj.optionalDependencies),
    permissions: blankObjectUndefined(obj.permissions),
  };
}

export function explodeEntry(pattern: string, obj: Object): LockManifest {
  obj.optionalDependencies = obj.optionalDependencies || {};
  obj.dependencies = obj.dependencies || {};
  obj.uid = obj.uid || obj.version;
  obj.permissions = obj.permissions || {};
  obj.registry = obj.registry || 'npm';
  obj.name = obj.name || getName(pattern);
  return obj;
}

export default class Lockfile {
  constructor(cache?: ?Object, source?: string) {
    this.source = source || '';
    this.cache = cache;
  }

  // source string if the `cache` was parsed
  source: string;

  cache: ?{
    [key: string]: LockManifest,
  };

  static async fromDirectory(dir: string, reporter?: Reporter): Promise<Lockfile> {
    // read the manifest in this directory
    const lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
    let lockfile;
    let rawLockfile = '';

    if (await fs.exists(lockfileLoc)) {
      rawLockfile = await fs.readFile(lockfileLoc);
      lockfile = parse(rawLockfile, lockfileLoc);
    } else {
      if (reporter) {
        reporter.info(reporter.lang('noLockfileFound'));
      }
    }

    return new Lockfile(lockfile, rawLockfile);
  }

  getLocked(pattern: string): ?LockManifest {
    const cache = this.cache;
    if (!cache) {
      return undefined;
    }

    const shrunk = pattern in cache && cache[pattern];

    if (typeof shrunk === 'string') {
      return this.getLocked(shrunk);
    } else if (shrunk) {
      explodeEntry(pattern, shrunk);
      return shrunk;
    }

    return undefined;
  }

  removePattern(pattern: string) {
    const cache = this.cache;
    if (!cache) {
      return;
    }
    delete cache[pattern];
  }

  getLockfile(patterns: {[packagePattern: string]: Manifest}): Object {
    const lockfile = {};
    const seen: Map<string, Object> = new Map();

    // order by name so that lockfile manifest is assigned to the first dependency with this manifest
    // the others that have the same remote.resolved will just refer to the first
    // ordering allows for consistency in lockfile when it is serialized
    const sortedPatternsKeys: Array<string> = Object.keys(patterns).sort(sortAlpha);

    for (const pattern of sortedPatternsKeys) {
      const pkg = patterns[pattern];
      const {_remote: remote, _reference: ref} = pkg;
      invariant(ref, 'Package is missing a reference');
      invariant(remote, 'Package is missing a remote');

      const seenPattern = remote.resolved && seen.get(remote.resolved);
      if (seenPattern) {
        // no point in duplicating it
        lockfile[pattern] = seenPattern;

        // if we're relying on our name being inferred and two of the patterns have
        // different inferred names then we need to set it
        if (!seenPattern.name && getName(pattern) !== pkg.name) {
          seenPattern.name = pkg.name;
        }
        continue;
      }

      const obj = implodeEntry(pattern, {
        name: pkg.name,
        version: pkg.version,
        uid: pkg._uid,
        resolved: remote.resolved,
        registry: remote.registry,
        dependencies: pkg.dependencies,
        peerDependencies: pkg.peerDependencies,
        optionalDependencies: pkg.optionalDependencies,
        permissions: ref.permissions,
      });
      lockfile[pattern] = obj;

      if (remote.resolved) {
        seen.set(remote.resolved, obj);
      }
    }

    return lockfile;
  }
}
