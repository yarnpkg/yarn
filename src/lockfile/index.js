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

import type { Reporter } from "kreporters";
import type { Manifest } from "../types.js";
import { MessageError } from "../errors.js";
import parse from "./parse.js";
import * as constants from "../constants.js";
import * as fs from "../util/fs.js";

let invariant = require("invariant");
let path      = require("path");
let _         = require("lodash");

export { default as parse } from "./parse";
export { default as stringify } from "./stringify";

export default class Lockfile {
  constructor(cache: ?Object, strict?: boolean, save?: boolean, source?: string) {
    this.strict = !!strict;
    this.source = source || "";
    this.cache  = cache;
    this.save   = !!save;
  }

  // source string if the `cache` was parsed
  source: string;

  // true if operation is just rehydrating node_modules folder
  strict: boolean;

  // true if lockfile will be persisted
  save: boolean;

  cache: ?{
    [key: string]: string | {
      name: string,
      version: string,
      resolved: string,
      registry: string,
      uid?: string,
      permissions?: { [key: string]: boolean },
      dependencies?: {
        [key: string]: string
      }
    }
  };

  static async fromDirectory(
    dir: string,
    reporter: Reporter,
    { strictIfPresent, save, silent }: {
      strictIfPresent?: boolean,
      save?: boolean,
      silent?: boolean
    }
  ): Promise<Lockfile> {
    // read the package.json in this directory
    let lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
    let lockfile;
    let rawLockfile = "";
    let strict = false;

    if (await fs.exists(lockfileLoc)) {
      rawLockfile = await fs.readFile(lockfileLoc);
      lockfile = parse(rawLockfile);
      strict = strictIfPresent;
      if (!silent) reporter.info(`Read lockfile ${constants.LOCKFILE_FILENAME}`);

      if (!strict) {
        if (!silent) {
          reporter.warn("Lockfile is not in strict mode. Any new versions will be installed arbitrarily.");
        }
      }
    } else {
      if (!silent) reporter.info("No lockfile found.");
    }

    return new Lockfile(lockfile, strict, save, rawLockfile);
  }

  isStrict(): boolean {
    return this.strict;
  }

  getLocked(pattern: string, noStrict?: boolean) {
    let cache = this.cache;
    if (!cache) return;

    let shrunk = pattern in cache && cache[pattern];
    if (typeof shrunk === "string" ) {
      return this.getLocked(shrunk, noStrict);
    } else if (shrunk) {
      shrunk.uid = shrunk.uid || shrunk.version;
      shrunk.permissions = shrunk.permissions || {};
      shrunk.registry = shrunk.registry || "npm";
      return shrunk;
    } else {
      if (!noStrict && this.strict) {
        throw new MessageError(`The pattern ${pattern} not found in lockfile`);
      }
    }
  }

  getLockfile(patterns: {
    [packagePattern: string]: Manifest
  }): Object {
    let lockfile = {};
    let seen: Map<Manifest, string> = new Map;

    for (let pattern in patterns) {
      let pkg = patterns[pattern];

      let seenPattern = seen.get(pkg);
      if (seenPattern) {
        // no point in duplicating it
        lockfile[pattern] = seenPattern;
        continue;
      }

      let ref = pkg.reference;
      invariant(ref, "Package is missing a reference");

      let remote = pkg.remote;
      invariant(remote, "Package is missing a remote");

      lockfile[pattern] = {
        name: pkg.name,
        version: pkg.version,
        uid: pkg.uid === pkg.version ? undefined : pkg.uid,
        resolved: remote.resolved,
        registry: remote.registry === "npm" ? undefined : remote.registry,
        dependencies: _.isEmpty(pkg.dependencies) ? undefined : pkg.dependencies,
        optionalDependencies: _.isEmpty(pkg.optionalDependencies) ? undefined : pkg.optionalDependencies,
        permissions: _.isEmpty(ref.permissions) ? undefined : ref.permissions
      };

      seen.set(pkg, pattern);
    }

    return lockfile;
  }
}
