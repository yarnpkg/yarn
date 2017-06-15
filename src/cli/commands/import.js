/* @flow */

import type {ResolverOptions} from '../../package-resolver.js';
import type {Manifest, DependencyRequestPattern, DependencyRequestPatterns} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Install} from './install.js';
import {verifyTreeCheck} from './check.js';
import {MessageError} from '../../errors.js';
import BaseResolver from '../../resolvers/base-resolver.js';
import HostedGitResolver, {explodeHostedGitFragment} from '../../resolvers/exotics/hosted-git-resolver.js';
import GistResolver, {explodeGistFragment} from '../../resolvers/exotics/gist-resolver.js';
import GitResolver from '../../resolvers/exotics/git-resolver.js';
import FileResolver from '../../resolvers/exotics/file-resolver.js';
import PackageResolver from '../../package-resolver.js';
import PackageRequest from '../../package-request.js';
import * as fetcher from '../../package-fetcher.js';
import PackageLinker from '../../package-linker.js';
import * as compatibility from '../../package-compatibility.js';
import Lockfile from '../../lockfile/wrapper.js';
import * as fs from '../../util/fs.js';
import * as util from '../../util/misc.js';
import {YARN_REGISTRY, LOCKFILE_FILENAME} from '../../constants.js';

const NPM_REGISTRY = /http[s]:\/\/registry.npmjs.org/g;

const invariant = require('invariant');
const path = require('path');
const uuid = require('uuid');

export const noArguments = true;

class ImportResolver extends BaseResolver {
  getCwd(): string {
    if (this.request.parentRequest) {
      const parent = this.resolver.getStrictResolvedPattern(this.request.parentRequest.pattern);
      invariant(parent._loc, 'expected package location');
      return path.dirname(parent._loc);
    }
    return this.config.cwd;
  }

  resolveHostedGit(info: Manifest, Resolver: typeof HostedGitResolver): Manifest {
    const {range} = PackageRequest.normalizePattern(this.pattern);
    const exploded = explodeHostedGitFragment(range, this.reporter);
    const hash = (info: any).gitHead;
    invariant(hash, 'expected package gitHead');
    const url = Resolver.getTarballUrl(exploded, hash);
    info._uid = hash;
    info._remote = {
      resolved: url,
      type: 'tarball',
      registry: this.registry,
      reference: url,
      hash: null,
    };
    return info;
  }

  resolveGist(info: Manifest, Resolver: typeof GistResolver): Manifest {
    const {range} = PackageRequest.normalizePattern(this.pattern);
    const {id} = explodeGistFragment(range, this.reporter);
    const hash = (info: any).gitHead;
    invariant(hash, 'expected package gitHead');
    const url = `https://gist.github.com/${id}.git`;
    info._uid = hash;
    info._remote = {
      resolved: `${url}#${hash}`,
      type: 'git',
      registry: this.registry,
      reference: url,
      hash,
    };
    return info;
  }

  resolveGit(info: Manifest, Resolver: typeof GitResolver): Manifest {
    const url = (info: any)._resolved;
    const hash = (info: any).gitHead;
    invariant(url, 'expected package _resolved');
    invariant(hash, 'expected package gitHead');
    info._uid = hash;
    info._remote = {
      resolved: `${url}#${hash}`,
      type: 'git',
      registry: this.registry,
      reference: url,
      hash,
    };
    return info;
  }

  resolveFile(info: Manifest, Resolver: typeof FileResolver): Manifest {
    const {range} = PackageRequest.normalizePattern(this.pattern);
    let loc = util.removePrefix(range, 'file:');
    if (!path.isAbsolute(loc)) {
      loc = path.join(this.config.cwd, loc);
    }
    info._uid = info.version;
    info._remote = {
      type: 'copy',
      registry: this.registry,
      hash: `${uuid.v4()}-${new Date().getTime()}`,
      reference: loc,
    };
    return info;
  }

  resolveRegistry(info: Manifest): Manifest {
    let url = (info: any)._resolved;
    const hash = (info: any)._shasum;
    invariant(url, 'expected package _resolved');
    invariant(hash, 'expected package _shasum');
    if (this.config.getOption('registry') === YARN_REGISTRY) {
      url = url.replace(NPM_REGISTRY, YARN_REGISTRY);
    }
    info._uid = info.version;
    info._remote = {
      resolved: `${url}#${hash}`,
      type: 'tarball',
      registry: this.registry,
      reference: url,
      hash,
    };
    return info;
  }

  resolveImport(info: Manifest): Manifest {
    const {range} = PackageRequest.normalizePattern(this.pattern);
    const Resolver = PackageRequest.getExoticResolver(range);
    if (Resolver && Resolver.prototype instanceof HostedGitResolver) {
      return this.resolveHostedGit(info, Resolver);
    } else if (Resolver && Resolver === GistResolver) {
      return this.resolveGist(info, Resolver);
    } else if (Resolver && Resolver === GitResolver) {
      return this.resolveGit(info, Resolver);
    } else if (Resolver && Resolver === FileResolver) {
      return this.resolveFile(info, Resolver);
    }
    return this.resolveRegistry(info);
  }

  async resolveLocation(loc): Promise<?Manifest> {
    const info = await this.config.tryManifest(loc, 'npm', false);
    if (!info) {
      return null;
    }
    return this.resolveImport(info);
  }

  async resolve(): Promise<Manifest> {
    const {name} = PackageRequest.normalizePattern(this.pattern);
    let cwd = this.getCwd();
    while (!path.relative(this.config.cwd, cwd).startsWith('..')) {
      const loc = path.join(cwd, 'node_modules', name);
      const info = await this.config.getCache(`import-resolver-${loc}`, () => this.resolveLocation(loc));
      if (info) {
        return info;
      }
      cwd = path.resolve(cwd, '../..');
    }
    throw new MessageError(this.reporter.lang('importResolveFailed', name, this.getCwd()));
  }
}

class ImportPackageRequest extends PackageRequest {
  constructor(req: DependencyRequestPattern, resolver: PackageResolver) {
    super(req, resolver);
    this.import = this.parentRequest instanceof ImportPackageRequest ? this.parentRequest.import : true;
  }

  import: boolean;

  getRootName(): string {
    return (this.resolver instanceof ImportPackageResolver && this.resolver.rootName) || 'root';
  }

  getParentHumanName(): string {
    return [this.getRootName()].concat(this.getParentNames()).join(' > ');
  }

  reportResolvedRangeMatch(info: Manifest, resolved: Manifest) {
    if (info.version === resolved.version) {
      return;
    }
    this.reporter.warn(
      this.reporter.lang(
        'importResolvedRangeMatch',
        resolved.version,
        resolved.name,
        info.version,
        this.getParentHumanName(),
      ),
    );
  }

  findVersionInfo(): Promise<Manifest> {
    if (!this.import) {
      this.reporter.verbose(this.reporter.lang('skippingImport', this.pattern, this.getParentHumanName()));
      return super.findVersionInfo();
    }
    const resolver = new ImportResolver(this, this.pattern);
    return resolver.resolve().catch(() => {
      this.import = false;
      this.reporter.warn(this.reporter.lang('importFailed', this.pattern, this.getParentHumanName()));
      return super.findVersionInfo();
    });
  }
}

class ImportPackageResolver extends PackageResolver {
  constructor(config: Config, lockfile: Lockfile) {
    super(config, lockfile);
    this.next = [];
    this.rootName = 'root';
  }

  next: DependencyRequestPatterns;
  rootName: string;

  find(req: DependencyRequestPattern): Promise<void> {
    this.next.push(req);
    return Promise.resolve();
  }

  async findOne(req: DependencyRequestPattern): Promise<void> {
    if (this.activity) {
      this.activity.tick(req.pattern);
    }
    const request = new ImportPackageRequest(req, this);
    await request.find({fresh: false});
  }

  async findAll(deps: DependencyRequestPatterns): Promise<void> {
    await Promise.all(deps.map(dep => this.findOne(dep)));
    deps = this.next;
    this.next = [];
    if (!deps.length) {
      // all required package versions have been discovered, so now packages that
      // resolved to existing versions can be resolved to their best available version
      this.resolvePackagesWithExistingVersions();
      return;
    }
    await this.findAll(deps);
  }

  resetOptional() {
    for (const pattern in this.patterns) {
      const ref = this.patterns[pattern]._reference;
      invariant(ref, 'expected reference');
      ref.optional = null;
      for (const req of ref.requests) {
        ref.addOptional(req.optional);
      }
    }
  }

  async init(
    deps: DependencyRequestPatterns,
    {isFlat, isFrozen, workspaceLayout}: ResolverOptions = {isFlat: false, isFrozen: false, workspaceLayout: undefined},
  ): Promise<void> {
    this.flat = Boolean(isFlat);
    const activity = (this.activity = this.reporter.activity());
    await this.findAll(deps);
    this.resetOptional();
    activity.end();
    this.activity = null;
  }
}

export class Import extends Install {
  constructor(flags: Object, config: Config, reporter: Reporter, lockfile: Lockfile) {
    super(flags, config, reporter, lockfile);
    this.resolver = new ImportPackageResolver(this.config, this.lockfile);
    this.linker = new PackageLinker(config, this.resolver);
  }

  async init(): Promise<Array<string>> {
    if (await fs.exists(path.join(this.config.cwd, LOCKFILE_FILENAME))) {
      throw new MessageError(this.reporter.lang('lockfileExists'));
    }
    await verifyTreeCheck(this.config, this.reporter, {}, []);
    const {requests, patterns, manifest} = await this.fetchRequestFromCwd();
    if (manifest.name && this.resolver instanceof ImportPackageResolver) {
      this.resolver.rootName = manifest.name;
    }
    await this.resolver.init(requests, {isFlat: this.flags.flat, isFrozen: this.flags.frozenLockfile});
    const manifests: Array<Manifest> = await fetcher.fetch(this.resolver.getManifests(), this.config);
    this.resolver.updateManifests(manifests);
    await compatibility.check(this.resolver.getManifests(), this.config, this.flags.ignoreEngines);
    await this.linker.resolvePeerModules();
    await this.saveLockfileAndIntegrity(patterns);
    return patterns;
  }
}

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const imp = new Import(flags, config, reporter, new Lockfile({}));
  await imp.init();
}
