/* @flow */

import type { PackageInfo } from "./types";
import type { PackageRegistry } from "./resolvers";
import type PackageResolver from "./package-resolver";
import type RequestManager from "./util/request-manager";
import type Reporter from "./reporters/_base";
import type Shrinkwrap from "./shrinkwrap";
import type Config from "./config";
import PackageReference from "./package-reference";
import { getRegistryResolver } from "./resolvers";
import { MessageError } from "./errors";
import * as constants from "./constants";
import * as versionUtil from "./util/version";
import * as resolvers from "./resolvers";

let invariant = require("invariant");

export default class PackageRequest {
  constructor({
    pattern,
    registry,
    config,
    reporter,
    requestManager,
    shrinkwrap,
    resolver,
    parentRequest
  }: {
    pattern: string,
    registry: PackageRegistry,
    config: Config,
    reporter: Reporter,
    requestManager: RequestManager,
    shrinkwrap: Shrinkwrap,
    resolver: PackageResolver,
    parentRequest: ?PackageRequest // eslint-disable-line no-unused-vars
  }) {
    this.parentRequest = parentRequest;
    this.requestManager  = requestManager;
    this.shrinkwrap      = shrinkwrap;
    this.registry        = registry;
    this.reporter        = reporter;
    this.resolver        = resolver;
    this.pattern         = pattern;
    this.config          = config;
  }

  static getExoticResolver(pattern: string): ?Function { // TODO make this type more refined
    for (let name in resolvers.exotics) {
      let Resolver = resolvers.exotics[name];
      if (Resolver.isVersion(pattern)) return Resolver;
    }
  }

  parentRequest: ?PackageRequest;
  requestManager: RequestManager;
  shrinkwrap: Shrinkwrap;
  reporter: Reporter;
  resolver: PackageResolver;
  pattern: string;
  config: Config;
  registry: PackageRegistry;

  getHuman(): string {
    let chain = [];

    let delegator = this;
    do {
      chain.push(`${delegator.registry}:${delegator.pattern}`);
    } while (delegator = delegator.parentRequest);

    return chain.reverse().join(" -> ");
  }

  getShrunk(remoteType: string): ?Object {
    let shrunk = this.shrinkwrap.getShrunk(this.pattern);

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
   * TODO description
   */

  async findVersionOnRegistry(pattern: string): Promise<PackageInfo> {
    let parts = pattern.split("@");
    let name = parts.shift();

    let range = "latest";
    if (parts.length) {
      range = parts.shift() || "*";
    }

    if (parts.length) {
      throw new Error("Too many parts");
    }

    let exoticResolver = PackageRequest.getExoticResolver(range);
    if (exoticResolver) {
      let data = await this.findExoticVersionInfo(exoticResolver, range);

      // TODO we might need to clone data if we're going to be touching `name` as this
      // package could have been resolved multiple times!

      // this is so the returned package response uses the overriden name. ie. if the
      // package's actual name is `bar`, but it's been specified in package.json like:
      //   "foo": "http://foo.com/bar.tar.gz"
      // then we use the foo name
      data.name = name;

      return data;
    }

    let Resolver = getRegistryResolver(this.registry);
    let resolver = new Resolver(this, name, range);
    return resolver.resolve();
  }

  /**
   * TODO description
   */

  async findExoticVersionInfo(ExoticResolver: Function, range: string): Promise<PackageInfo> {
    let resolver = new ExoticResolver(this, range);
    return resolver.resolve();
  }

  /**
   * TODO description
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
    this.resolver.addPattern(this.pattern, info);

    // start installation of dependencies
    let promises = [];
    let deps = [];

    //
    let remote = info.remote;
    invariant(remote, "Missing remote");

    // normal deps
    for (let depName in info.dependencies) {
      let depPattern = depName + "@" + info.dependencies[depName];
      deps.push(depPattern);
      promises.push(this.resolver.find(depPattern, remote.registry, false, this));
    }

    // optional deps
    for (let depName in info.optionalDependencies) {
      let depPattern = depName + "@" + info.optionalDependencies[depName];
      deps.push(depPattern);
      promises.push(this.resolver.find(depPattern, remote.registry, true, this));
    }

    // set package reference
    let ref = info.reference = new PackageReference(info, remote, deps, this.shrinkwrap);
    ref.addPattern(this.pattern);
    ref.addOptional(optional);

    await Promise.all(promises);

    this.resolver.registerPackageReference(info.reference);
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
