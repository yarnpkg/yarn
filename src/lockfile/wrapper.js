/* @flow */

import type {Reporter} from '../reporters/index.js';
import type {Manifest} from '../types.js';
import {sortAlpha} from '../util/misc.js';
import PackageRequest from '../package-request.js';
import parse from './parse.js';
import * as constants from '../constants.js';
import * as fs from '../util/fs.js';

let invariant = require('invariant');
let path = require('path');

export {default as parse} from './parse';
export {default as stringify} from './stringify';

type Dependencies = {
  [key: string]: string,
};

type LockManifest = {
  name: string,
  version: string,
  resolved: string,
  registry: string,
  uid?: string,
  permissions?: { [key: string]: boolean },
  optionalDependencies?: Dependencies,
  dependencies?: Dependencies,
};

function getName(pattern: string): string {
  return PackageRequest.normalisePattern(pattern).name;
}

function blankObjectUndefined(obj: ?Object): ?Object {
  return obj && Object.keys(obj).length ? obj : undefined;
}

export default class Lockfile {
  constructor(cache?: ?Object, source?: string) {
    this.source = source || '';
    this.cache = cache;
  }

  // source string if the `cache` was parsed
  source: string;

  cache: ?{
    [key: string]: string | LockManifest
  };

  static async fromDirectory(dir: string, reporter?: Reporter): Promise<Lockfile> {
    // read the manifest in this directory
    let lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
    let lockfile;
    let rawLockfile = '';

    if (await fs.exists(lockfileLoc)) {
      rawLockfile = await fs.readFile(lockfileLoc);
      lockfile = parse(rawLockfile);
    } else {
      if (reporter) {
        reporter.info(reporter.lang('noLockfileFound'));
      }
    }

    return new Lockfile(lockfile, rawLockfile);
  }

  getLocked(pattern: string): ?LockManifest {
    let cache = this.cache;
    if (!cache) {
      return undefined;
    }

    let shrunk = pattern in cache && cache[pattern];
    if (typeof shrunk === 'string') {
      return this.getLocked(shrunk);
    } else if (shrunk) {
      shrunk.uid = shrunk.uid || shrunk.version;
      shrunk.permissions = shrunk.permissions || {};
      shrunk.registry = shrunk.registry || 'npm';
      shrunk.name = shrunk.name || getName(pattern);
      return shrunk;
    }

    return undefined;
  }

  getLockfile(patterns: {
    [packagePattern: string]: Manifest
  }): Object {
    let lockfile = {};
    let seen: Map<string, Object> = new Map();

    // order by name so that lockfile manifest is assigned to the first dependency with this manifest
    // the others that have the same remote.resolved will just refer to the first
    // ordering allows for consistency in lockfile when it is serialized
    let sortedPatternsKeys: Array<string> = Object.keys(patterns).sort(sortAlpha);

    for (let pattern of sortedPatternsKeys) {
      let pkg = patterns[pattern];
      let {_remote: remote, _reference: ref} = pkg;
      invariant(ref, 'Package is missing a reference');
      invariant(remote, 'Package is missing a remote');

      let seenPattern = remote.resolved && seen.get(remote.resolved);
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

      let inferredName = getName(pattern);
      let obj = {
        name: inferredName === pkg.name ? undefined : pkg.name,
        version: pkg.version,
        uid: pkg._uid === pkg.version ? undefined : pkg._uid,
        resolved: remote.resolved,
        registry: remote.registry === 'npm' ? undefined : remote.registry,
        dependencies: blankObjectUndefined(pkg.dependencies),
        optionalDependencies: blankObjectUndefined(pkg.optionalDependencies),
        permissions: blankObjectUndefined(ref.permissions),
      };
      lockfile[pattern] = obj;

      if (remote.resolved) {
        seen.set(remote.resolved, obj);
      }
    }

    return lockfile;
  }
}
