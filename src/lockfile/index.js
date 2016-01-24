/* @flow */

import type PackageResolver from "../package-resolver";
import type Reporter from "../reporters/_base";
import { MessageError } from "../errors";
import parse from "./parse";
import * as constants from "../constants";
import * as fs from "../util/fs";

let invariant = require("invariant");
let stripBOM  = require("strip-bom");
let path      = require("path");
let _         = require("lodash");

export default class Lockfile {
  constructor(cache: ?Object, strict: boolean) {
    this.strict = strict;
    this.cache  = cache;
  }

  strict: boolean;

  cache: ?{
    [key: string]: string | {
      name: string,
      version: string,
      resolved: string,
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
    strictIfPresent: boolean,
  ): Promise<Lockfile> {
    // read the package.json in this directory
    let lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
    let lockfile;
    let strict = false;

    if (await fs.exists(lockfileLoc)) {
      lockfile = await fs.readFile(lockfileLoc);
      lockfile = parse(stripBOM(lockfile));
      strict = strictIfPresent;
      reporter.info(`Read lockfile ${constants.LOCKFILE_FILENAME}`);

      if (!strict) {
        reporter.warn(`Lockfile is not in strict mode. Any new versions will be installed arbitrarily.`);
      }
    } else {
      reporter.info(`No lockfile found.`);
    }

    return new Lockfile(lockfile, strict);
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

  getLockfile(resolver: PackageResolver): Object {
    let lockfile = {};

    for (let pattern in resolver.patterns) {
      let pkg = resolver.patterns[pattern];
      if (pkg._lockfileRef) {
        // no point in duplicating it
        lockfile[pattern] = pkg._lockfileRef;
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
        permissions: _.isEmpty(ref.permissions) ? undefined : ref.permissions
      };

      pkg._lockfileRef = pattern;
    }

    return lockfile;
  }
}
