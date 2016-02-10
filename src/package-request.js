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

import type { PackageInfo } from "./types.js";
import type { RegistryNames } from "./registries/index.js";
import type PackageResolver from "./package-resolver.js";
import type Reporter from "./reporters/_base.js";
import type Config from "./config.js";
import Lockfile, { parse as parseLock } from "./lockfile/index.js";
import PackageReference from "./package-reference.js";
import { registries as registryResolvers } from "./resolvers/index.js";
import { MessageError } from "./errors.js";
import * as constants from "./constants.js";
import * as versionUtil from "./util/version.js";
import * as resolvers from "./resolvers/index.js";
import * as fs from "./util/fs.js";

let invariant = require("invariant");
let path      = require("path");

export default class PackageRequest {
  constructor({
    pattern,
    registry,
    resolver,
    lockfile,
    parentRequest
  }: {
    pattern: string,
    lockfile: ?Lockfile,
    registry: RegistryNames,
    resolver: PackageResolver,
    parentRequest: ?PackageRequest // eslint-disable-line no-unused-vars
  }) {
    this.parentRequest = parentRequest;
    this.rootLockfile  = resolver.lockfile;
    this.subLockfile   = lockfile;
    this.registry      = registry;
    this.reporter      = resolver.reporter;
    this.resolver      = resolver;
    this.pattern       = pattern;
    this.config        = resolver.config;
  }

  static getExoticResolver(pattern: string): ?Function { // TODO make this type more refined
    for (let name in resolvers.exotics) {
      let Resolver = resolvers.exotics[name];
      if (Resolver.isVersion(pattern)) return Resolver;
    }
  }

  parentRequest: ?PackageRequest;
  rootLockfile: Lockfile;
  subLockfile: ?Lockfile;
  reporter: Reporter;
  resolver: PackageResolver;
  pattern: string;
  config: Config;
  registry: RegistryNames;

  getHuman(): string {
    let chain = [];

    let delegator = this;
    do {
      chain.push(`${delegator.registry}:${delegator.pattern}`);
    } while (delegator = delegator.parentRequest);

    return chain.reverse().join(" -> ");
  }

  getLocked(remoteType: string): ?Object {
    // alaways prioritise root lockfile
    let shrunk = this.rootLockfile.getLocked(this.pattern, !!this.subLockfile);

    // falback to sub lockfile if exists
    if (this.subLockfile && !shrunk) {
      shrunk = this.subLockfile.getLocked(this.pattern);
    }

    if (shrunk) {
      let resolvedParts = versionUtil.explodeHashedUrl(shrunk.resolved);

      return {
        name: shrunk.name,
        version: shrunk.version,
        uid: shrunk.uid,
        remote: {
          resolved: shrunk.resolved,
          type: remoteType,
          reference: resolvedParts.url,
          hash: resolvedParts.hash,
          registry: shrunk.registry
        },
        dependencies: shrunk.dependencies
      };
    }
  }

  /**
   * If the input pattern matches a registry one then attempt to find it on the registry.
   * Otherwise fork off to an exotic resolver if one matches.
   */

  async findVersionOnRegistry(pattern: string): Promise<PackageInfo> {
    let range = "latest";
    let name  = pattern;

    // matches a version tuple in the form of NAME@VERSION. allows the first character to
    // be an @ for scoped packages
    let match = pattern.match(/^(.{1,})@(.*?)$/);
    if (match) {
      name = match[1];
      range = match[2] || "*";
    }

    let exoticResolver = PackageRequest.getExoticResolver(range);
    if (exoticResolver) {
      let data = await this.findExoticVersionInfo(exoticResolver, range);

      // clone data as we're manipulating it in place and this could be resolved multiple
      // times
      data = Object.assign({}, data);

      // this is so the returned package response uses the overriden name. ie. if the
      // package's actual name is `bar`, but it's been specified in package.json like:
      //   "foo": "http://foo.com/bar.tar.gz"
      // then we use the foo name
      data.name = name;

      return data;
    }

    let Resolver = registryResolvers[this.registry];
    if (!Resolver) {
      throw new Error(`Unknown registry resolver ${this.registry}`);
    }

    let resolver = new Resolver(this, name, range);
    return resolver.resolve();
  }

  /**
   * Construct an exotic resolver instance with the input `ExoticResolver` and `range`.
   */

  async findExoticVersionInfo(ExoticResolver: Function, range: string): Promise<PackageInfo> {
    let resolver = new ExoticResolver(this, range);
    return resolver.resolve();
  }

  /**
   * If the current pattern matches an exotic resolver then delegate to it or else try
   * the registry.
   */

  async findVersionInfo(): Promise<PackageInfo> {
    let exoticResolver = PackageRequest.getExoticResolver(this.pattern);
    if (exoticResolver) {
      return await this.findExoticVersionInfo(exoticResolver, this.pattern);
    } else {
      return await this.findVersionOnRegistry(this.pattern);
    }
  }

  /**
   * TODO description
   */

  async find(optional: boolean): Promise<void> {
    let info: ?PackageInfo;

    // find verison info for this package pattern
    try {
      info = await this.findVersionInfo();
      if (!info) throw new MessageError(`Couldn't find package ${this.pattern}`);
    } catch (err) {
      if (optional) {
        // TODO add verbose flag
        this.reporter.error(err.message);
        return;
      } else {
        throw err;
      }
    }

    // check if while we were resolving this dep we've already resolved one that satisfies
    // the same range
    let resolved: ?PackageInfo = this.resolver.getExactVersionMatch(info.name, info.version);
    if (resolved) {
      let ref = resolved.reference;
      invariant(ref, "Resolved package info has no package reference");
      ref.addPattern(this.pattern);
      ref.addOptional(optional);
      this.resolver.addPattern(this.pattern, resolved);
      return;
    }

    // validate version info
    PackageRequest.validateVersionInfo(info);

    //
    let remote = info.remote;
    invariant(remote, "Missing remote");

    // set package reference
    let ref = new PackageReference(info, remote, this.rootLockfile, this.config);

    // in order to support lockfiles inside transitive dependencies we need to block
    // resolution to fetch the package so we can peek inside of it for a kpm.lock
    // only do this in strict lockfile mode as otherwise we can just use our root lockfile
    let subLockfile = null;
    if (!this.resolver.lockfile.strict) {
      let { package: newInfo, hash, dest } = await this.resolver.fetchingQueue.push(
        info.name,
        () => this.resolver.fetcher.fetch(ref)
      );
      newInfo.reference = ref;
      newInfo.remote = remote;
      remote.hash = hash;
      info = newInfo;

      // find and load in kpm.lock from this module if it exists
      let lockfileLoc = path.join(dest, constants.LOCKFILE_FILENAME);
      if (await fs.exists(lockfileLoc)) {
        let rawLockfile = await fs.readFile(lockfileLoc);
        let lockfileObj = parseLock(rawLockfile);
        subLockfile = new Lockfile(lockfileObj, false);
      }
    }

    // start installation of dependencies
    let promises = [];
    let deps = [];

    // normal deps
    for (let depName in info.dependencies) {
      let depPattern = depName + "@" + info.dependencies[depName];
      deps.push(depPattern);
      promises.push(this.resolver.find(depPattern, remote.registry, false, this, subLockfile));
    }

    // optional deps
    for (let depName in info.optionalDependencies) {
      let depPattern = depName + "@" + info.optionalDependencies[depName];
      deps.push(depPattern);
      promises.push(this.resolver.find(depPattern, remote.registry, true, this, subLockfile));
    }

    await Promise.all(promises);

    this.resolver.addPattern(this.pattern, info);
    ref.setDependencies(deps);
    ref.addPattern(this.pattern);
    ref.addOptional(optional);
    this.resolver.registerPackageReference(ref);
  }

  /**
   * TODO description
   */

  static validateVersionInfo(info: PackageInfo) {
    // human readable name to use in errors
    let human = `${info.name}@${info.version}`;

    info.version = PackageRequest.getPackageVersion(info);

    for (let key of constants.REQUIRED_PACKAGE_KEYS) {
      if (!info[key]) throw new MessageError(`Package ${human} doesn't have a ${key}`);
    }
  }

  /**
   * Returns the package version if present, else defaults to the uid
   */

  static getPackageVersion(info: PackageInfo): string {
    // TODO possibly reconsider this behaviour
    return info.version === undefined ? info.uid : info.version;
  }
}
