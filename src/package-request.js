/* @flow */

import type {Dependency, DependencyRequestPattern, Manifest} from './types.js';
import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {Install} from './cli/commands/install';
import {cleanDependencies} from './util/normalize-manifest/validate.js';
import Lockfile from './lockfile/wrapper.js';
import PackageReference from './package-reference.js';
import {registries as registryResolvers} from './resolvers/index.js';
import {MessageError} from './errors.js';
import {entries} from './util/misc.js';
import * as constants from './constants.js';
import * as versionUtil from './util/version.js';
import WorkspaceResolver from './resolvers/contextual/workspace-resolver.js';
import * as resolvers from './resolvers/index.js';
import * as fs from './util/fs.js';

const path = require('path');
const invariant = require('invariant');
const semver = require('semver');

type ResolverRegistryNames = $Keys<typeof registryResolvers>;

export default class PackageRequest {
  constructor(req: DependencyRequestPattern, resolver: PackageResolver) {
    this.parentRequest = req.parentRequest;
    this.lockfile = resolver.lockfile;
    this.registry = req.registry;
    this.reporter = resolver.reporter;
    this.resolver = resolver;
    this.optional = req.optional;
    this.pattern = req.pattern;
    this.config = resolver.config;
    this.foundInfo = null;

    resolver.usedRegistries.add(req.registry);
  }

  static getExoticResolver(pattern: string): ?Function {
    // TODO make this type more refined
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
  optional: boolean;
  foundInfo: ?Manifest;

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

    if (shrunk && shrunk.resolved) {
      const resolvedParts = versionUtil.explodeHashedUrl(shrunk.resolved);
      // If it's a private git url set remote to 'git'.
      const preferredRemoteType = resolvedParts.url.startsWith('git+ssh://') ? 'git' : remoteType;

      return {
        name: shrunk.name,
        version: shrunk.version,
        _uid: shrunk.uid,
        _remote: {
          resolved: shrunk.resolved,
          type: preferredRemoteType,
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
    const {range, name} = await this.normalize(pattern);

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
      throw new MessageError(this.reporter.lang('unknownRegistryResolver', this.registry));
    }
  }

  async normalizeRange(pattern: string): Promise<string> {
    if (pattern.includes(':') || pattern.includes('@') || PackageRequest.getExoticResolver(pattern)) {
      return Promise.resolve(pattern);
    }

    if (await fs.exists(path.join(this.config.cwd, pattern))) {
      return Promise.resolve(`file:${pattern}`);
    }

    return Promise.resolve(pattern);
  }

  async normalize(pattern: string): any {
    const {name, range, hasVersion} = PackageRequest.normalizePattern(pattern);
    const newRange = await this.normalizeRange(range);
    return {name, range: newRange, hasVersion};
  }

  /**
   * Explode and normalize a pattern into it's name and range.
   */

  static normalizePattern(
    pattern: string,
  ): {
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

  findVersionInfo(): Promise<Manifest> {
    const exoticResolver = PackageRequest.getExoticResolver(this.pattern);

    if (exoticResolver) {
      return this.findExoticVersionInfo(exoticResolver, this.pattern);
    } else if (WorkspaceResolver.isWorkspace(this.pattern, this.resolver.workspaceLayout)) {
      invariant(this.resolver.workspaceLayout, 'expected workspaceLayout');
      const resolver = new WorkspaceResolver(this, this.pattern, this.resolver.workspaceLayout);
      return resolver.resolve();
    } else {
      return this.findVersionOnRegistry(this.pattern);
    }
  }

  reportResolvedRangeMatch(info: Manifest, resolved: Manifest) {}

  /**
   * Do the final resolve of a package that had a match with an existing version.
   * After all unique versions have been discovered, so the best available version
   * is found.
   */
  resolveToExistingVersion(info: Manifest) {
    // get final resolved version
    const {range, name} = PackageRequest.normalizePattern(this.pattern);
    const resolved: ?Manifest = this.resolver.getHighestRangeVersionMatch(name, range);
    invariant(resolved, 'should have a resolved reference');

    this.reportResolvedRangeMatch(info, resolved);
    const ref = resolved._reference;
    invariant(ref, 'Resolved package info has no package reference');
    ref.addRequest(this);
    ref.addPattern(this.pattern, resolved);
  }

  /**
   * TODO description
   */
  async find({fresh, frozen}: {fresh: boolean, frozen?: boolean}): Promise<void> {
    // find version info for this package pattern
    const info: Manifest = await this.findVersionInfo();

    info.fresh = fresh;
    cleanDependencies(info, false, this.reporter, () => {
      // swallow warnings
    });

    // check if while we were resolving this dep we've already resolved one that satisfies
    // the same range
    const {range, name} = PackageRequest.normalizePattern(this.pattern);
    const resolved: ?Manifest = frozen
      ? this.resolver.getExactVersionMatch(name, range)
      : this.resolver.getHighestRangeVersionMatch(name, range);
    if (resolved) {
      this.resolver.reportPackageWithExistingVersion(this, info);
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
    ref.setFresh(fresh);
    info._reference = ref;
    info._remote = remote;

    // start installation of dependencies
    const promises = [];
    const deps = [];

    // normal deps
    for (const depName in info.dependencies) {
      const depPattern = depName + '@' + info.dependencies[depName];
      deps.push(depPattern);
      promises.push(
        this.resolver.find({
          pattern: depPattern,
          registry: remote.registry,
          // dependencies of optional dependencies should themselves be optional
          optional: this.optional,
          parentRequest: this,
        }),
      );
    }

    // optional deps
    for (const depName in info.optionalDependencies) {
      const depPattern = depName + '@' + info.optionalDependencies[depName];
      deps.push(depPattern);
      promises.push(
        this.resolver.find({
          pattern: depPattern,
          registry: remote.registry,
          optional: true,
          parentRequest: this,
        }),
      );
    }
    if (remote.type === 'workspace' && !this.config.production) {
      // workspaces support dev dependencies
      for (const depName in info.devDependencies) {
        const depPattern = depName + '@' + info.devDependencies[depName];
        deps.push(depPattern);
        promises.push(
          this.resolver.find({
            pattern: depPattern,
            registry: remote.registry,
            optional: false,
            parentRequest: this,
          }),
        );
      }
    }

    for (const promise of promises) {
      await promise;
    }

    ref.addDependencies(deps);

    // Now that we have all dependencies, it's safe to propagate optional
    for (const otherRequest of ref.requests.slice(1)) {
      ref.addOptional(otherRequest.optional);
    }
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

  /**
   * Gets all of the outdated packages and sorts them appropriately
   */

  static async getOutdatedPackages(
    lockfile: Lockfile,
    install: Install,
    config: Config,
    reporter: Reporter,
  ): Promise<Array<Dependency>> {
    const {requests: depReqPatterns} = await install.fetchRequestFromCwd();

    const deps = await Promise.all(
      depReqPatterns.map(async ({pattern, hint}): Promise<Dependency> => {
        const locked = lockfile.getLocked(pattern);
        if (!locked) {
          throw new MessageError(reporter.lang('lockfileOutdated'));
        }

        const {name, version: current} = locked;
        let latest = '';
        let wanted = '';
        let url = '';

        const normalized = PackageRequest.normalizePattern(pattern);

        if (PackageRequest.getExoticResolver(pattern) || PackageRequest.getExoticResolver(normalized.range)) {
          latest = wanted = 'exotic';
          url = normalized.range;
        } else {
          const registry = config.registries[locked.registry];

          ({latest, wanted, url} = await registry.checkOutdated(config, name, normalized.range));
        }

        return {name, current, wanted, latest, url, hint};
      }),
    );

    // Make sure to always output `exotic` versions to be compatible with npm
    const isDepOld = ({current, latest, wanted}) =>
      latest === 'exotic' || (latest !== 'exotic' && (semver.lt(current, wanted) || semver.lt(current, latest)));
    const orderByName = (depA, depB) => depA.name.localeCompare(depB.name);

    return deps.filter(isDepOld).sort(orderByName);
  }
}
