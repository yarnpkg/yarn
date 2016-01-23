/* @flow */

import type PackageResolver from "./package-resolver";
import type Reporter from "./reporters/_base";
import { MessageError } from "./errors";
import * as constants from "./constants";
import * as fs from "./util/fs";

let invariant = require("invariant");
let path      = require("path");
let _         = require("lodash");

export default class Shrinkwrap {
  constructor(cache: ?Object, strict: boolean) {
    this.strict = strict;
    this.cache  = cache;
  }

  strict: boolean;

  cache: ?{
    [key: string]: {
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
  ): Promise<Shrinkwrap> {
    // read the package.json in this directory
    let shrinkwrapLoc = path.join(dir, constants.SHRINKWRAP_FILENAME);
    let shrinkwrap;
    let strict = false;

    if (await fs.exists(shrinkwrapLoc)) {
      shrinkwrap = await fs.readJson(shrinkwrapLoc);
      strict = strictIfPresent;
      reporter.info(`Read shrinkwrap ${constants.SHRINKWRAP_FILENAME}`);

      if (!strict) {
        reporter.warn(`Shrinkwrap is not in strict mode. Any new versions will be installed arbitrarily.`);
      }
    } else {
      reporter.info(`No shrinkwrap found.`);
    }

    return new Shrinkwrap(shrinkwrap, strict);
  }

  isStrict(): boolean {
    return this.strict;
  }

  getShrunk(pattern: string, noStrict?: boolean) {
    let cache = this.cache;
    if (!cache) return;

    let shrunk = pattern in cache && cache[pattern];
    if (shrunk) {
      shrunk.uid = shrunk.uid || shrunk.version;
      shrunk.permissions = shrunk.permissions || {};
      return shrunk;
    } else {
      if (!noStrict && this.strict) {
        throw new MessageError(`The pattern ${pattern} not found in shrinkwrap`);
      }
    }
  }

  getShrinkwrapped(resolver: PackageResolver): Object {
    let shrinkwrap = {};

    for (let pattern in resolver.patterns) {
      let pkg = resolver.patterns[pattern];

      let ref = pkg.reference;
      invariant(ref, "Package is missing a reference");

      let remote = pkg.remote;
      invariant(remote, "Package is missing a remote");

      shrinkwrap[pattern] = {
        name: pkg.name,
        version: pkg.version,
        uid: pkg.uid === pkg.version ? undefined : pkg.uid,
        resolved: remote.resolved,
        registry: remote.registry,
        dependencies: _.isEmpty(pkg.dependencies) ? undefined : pkg.dependencies,
        permissions: _.isEmpty(ref.permissions) ? undefined : ref.permissions
      };
    }

    return shrinkwrap;
  }
}
