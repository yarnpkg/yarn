/* @flow */

import type {DependencyRequestPattern, Manifest} from './types.js';
import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {VisibilityAction} from './package-reference.js';
import {cleanDependencies} from './util/normalize-manifest/validate.js';
import Lockfile from './lockfile/wrapper.js';
import {USED as USED_VISIBILITY, default as PackageReference} from './package-reference.js';
import {registries as registryResolvers} from './resolvers/index.js';
import {MessageError} from './errors.js';
import {entries} from './util/misc.js';
import * as constants from './constants.js';
import * as versionUtil from './util/version.js';
import * as resolvers from './resolvers/index.js';

const invariant = require('invariant');

type ResolverRegistryNames = $Keys<typeof registryResolvers>;

export default class PackageRequest {
  constructor(req: DependencyRequestPattern, resolver: PackageResolver) {
    this.parentRequest = req.parentRequest;
    this.visibility = req.visibility;
    this.lockfile = resolver.lockfile;
    this.registry = req.registry;
    this.reporter = resolver.reporter;
    this.resolver = resolver;
    this.optional = req.optional;
    this.pattern = req.pattern;
    this.config = resolver.config;

    resolver.usedRegistries.add(req.registry);
  }

  static getExoticResolver(pattern: string): ?Function { // TODO make this type more refined
    for (const [, Resolver] of entries(resolvers.exotics)) {
      if (Resolver.isVersion(pattern)) {
        return Resolver;
      }
    }
    return null;
  }

  parentRequest: ?PackageRequest;
  lockfile: Lockfile;
  reporter: Reporter;
  resolver: PackageResolver;
  pattern: string;
  config: Config;
  registry: ResolverRegistryNames;
  visibility: VisibilityAction;
  optional: boolean;

  getParentNames(): Array<string> {
    const chain = [];

    let request = this.parentRequest;
    while (request) {
      const info = this.resolver.getStrictResolvedPattern(request.pattern);
      chain.unshift(info.name);

      request = request.parentRequest;
    }

    return chain;
  }

  getLocked(remoteType: string): ?Object {
    // always prioritise root lockfile
    const shrunk = this.lockfile.getLocked(this.pattern);

    if (shrunk) {
      const resolvedParts = versionUtil.explodeHashedUrl(shrunk.resolved);

      return {
        name: shrunk.name,
        version: shrunk.version,
        _uid: shrunk.uid,
        _remote: {
          resolved: shrunk.resolved,
          type: remoteType,
          reference: resolvedParts.url,
          hash: resolvedParts.hash,
          registry: shrunk.registry,
        },
        optionalDependencies: shrunk.optionalDependencies,
        dependencies: shrunk.dependencies,
      };
    } else {
      return null;
    }
  }

  /**
   * If the input pattern matches a registry one then attempt to find it on the registry.
   * Otherwise fork off to an exotic resolver if one matches.
   */

  async findVersionOnRegistry(pattern: string): Promise<Manifest> {
    const {range, name} = PackageRequest.normalizePattern(pattern);

    const exoticResolver = PackageRequest.getExoticResolver(range);
    if (exoticResolver) {
      let data = await this.findExoticVersionInfo(exoticResolver, range);

      // clone data as we're manipulating it in place and this could be resolved multiple
      // times
      data = Object.assign({}, data);

      // this is so the returned package response uses the overridden name. ie. if the
      // package's actual name is `bar`, but it's been specified in the manifest like:
      //   "foo": "http://foo.com/bar.tar.gz"
      // then we use the foo name
      data.name = name;

      return data;
    }

    const Resolver = this.getRegistryResolver();
    const resolver = new Resolver(this, name, range);
    return resolver.resolve();
  }

  /**
   * Get the registry resolver associated with this package request.
   */

  getRegistryResolver(): Function {
    const Resolver = registryResolvers[this.registry];
    if (Resolver) {
      return Resolver;
    } else {
      throw new MessageError(`Unknown registry resolver ${this.registry}`);
    }
  }

  /**
   * Explode and normalize a pattern into it's name and range.
   */

  static normalizePattern(pattern: string): {
    hasVersion: boolean,
    name: string,
    range: string,
  } {
    let hasVersion = false;
    let range = 'latest';
    let name = pattern;

    // if we're a scope then remove the @ and add it back later
    let isScoped = false;
    if (name[0] === '@') {
      isScoped = true;
      name = name.slice(1);
    }

    // take first part as the name
    const parts = name.split('@');
    if (parts.length > 1) {
      name = parts.shift();
      range = parts.join('@');

      if (range) {
        hasVersion = true;
      } else {
        range = '*';
      }
    }

    // add back @ scope suffix
    if (isScoped) {
      name = `@${name}`;
    }

    return {name, range, hasVersion};
  }

  /**
   * Construct an exotic resolver instance with the input `ExoticResolver` and `range`.
   */

  findExoticVersionInfo(ExoticResolver: Function, range: string): Promise<Manifest> {
    const resolver = new ExoticResolver(this, range);
    return resolver.resolve();
  }

  /**
   * If the current pattern matches an exotic resolver then delegate to it or else try
   * the registry.
   */

  async findVersionInfo(): Promise<Manifest> {
    const exoticResolver = PackageRequest.getExoticResolver(this.pattern);
    if (exoticResolver) {
      return await this.findExoticVersionInfo(exoticResolver, this.pattern);
    } else {
      return await this.findVersionOnRegistry(this.pattern);
    }
  }

  /**
   * TODO description
   */

  async find(): Promise<void> {
    // find version info for this package pattern
    const info: ?Manifest = await this.findVersionInfo();
    if (!info) {
      throw new MessageError(this.reporter.lang('unknownPackage', this.pattern));
    }

    cleanDependencies(info, false, this.reporter, () => {
      // swallow warnings
    });

    // check if while we were resolving this dep we've already resolved one that satisfies
    // the same range
    const resolved: ?Manifest = this.resolver.getExactVersionMatch(info.name, info.version);
    if (resolved) {
      const ref = resolved._reference;
      invariant(ref, 'Resolved package info has no package reference');
      ref.addRequest(this);
      ref.addPattern(this.pattern, resolved);
      ref.addOptional(this.optional);
      ref.addVisibility(this.visibility);
      return;
    }

    if (info.flat && !this.resolver.flat) {
      throw new MessageError(this.reporter.lang('flatGlobalError'));
    }

    // validate version info
    PackageRequest.validateVersionInfo(info, this.reporter);

    //
    const remote = info._remote;
    invariant(remote, 'Missing remote');

    // set package reference
    const ref = new PackageReference(this, info, remote);
    ref.addPattern(this.pattern, info);
    ref.addOptional(this.optional);
    ref.addVisibility(this.visibility);
    info._reference = ref;
    info._remote = remote;

    // start installation of dependencies
    const promises = [];
    const deps = [];

    // normal deps
    for (const depName in info.dependencies) {
      const depPattern = depName + '@' + info.dependencies[depName];
      deps.push(depPattern);
      promises.push(this.resolver.find({
        pattern: depPattern,
        registry: remote.registry,
        visibility: USED_VISIBILITY,
        optional: false,
        parentRequest: this,
      }));
    }

    // optional deps
    for (const depName in info.optionalDependencies) {
      const depPattern = depName + '@' + info.optionalDependencies[depName];
      deps.push(depPattern);
      promises.push(this.resolver.find({
        pattern: depPattern,
        registry: remote.registry,
        visibility: USED_VISIBILITY,
        optional: true,
        parentRequest: this,
      }));
    }

    await Promise.all(promises);
    ref.addDependencies(deps);
  }

  /**
   * TODO description
   */

  static validateVersionInfo(info: Manifest, reporter: Reporter) {
    // human readable name to use in errors
    const human = `${info.name}@${info.version}`;

    info.version = PackageRequest.getPackageVersion(info);

    for (const key of constants.REQUIRED_PACKAGE_KEYS) {
      if (!info[key]) {
        throw new MessageError(reporter.lang('missingRequiredPackageKey', human, key));
      }
    }
  }

  /**
   * Returns the package version if present, else defaults to the uid
   */

  static getPackageVersion(info: Manifest): string {
    // TODO possibly reconsider this behaviour
    return info.version === undefined ? info._uid : info.version;
  }
}
