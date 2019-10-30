/* @flow */

import type {RegistryNames} from '../../registries/index.js';
import type {Reporter} from '../../reporters/index.js';
import type {InstallCwdRequest} from './install.js';
import type {DependencyRequestPatterns, Manifest} from '../../types.js';
import type Config, {RootManifests} from '../../config.js';
import type {ListOptions} from './list.js';
import Lockfile from '../../lockfile';
import {normalizePattern} from '../../util/normalize-pattern.js';
import WorkspaceLayout from '../../workspace-layout.js';
import {getExoticResolver} from '../../resolvers/index.js';
import {buildTree} from './list.js';
import {wrapLifecycle, Install} from './install.js';
import {MessageError} from '../../errors.js';
import * as constants from '../../constants.js';
import * as fs from '../../util/fs.js';

import invariant from 'invariant';
import path from 'path';
import semver from 'semver';

const SILENCE_DEPENDENCY_TYPE_WARNINGS = ['upgrade', 'upgrade-interactive'];

export class Add extends Install {
  constructor(args: Array<string>, flags: Object, config: Config, reporter: Reporter, lockfile: Lockfile) {
    const workspaceRootIsCwd = config.cwd === config.lockfileFolder;
    const _flags = flags ? {...flags, workspaceRootIsCwd} : {workspaceRootIsCwd};
    super(_flags, config, reporter, lockfile);
    this.args = args;
    // only one flag is supported, so we can figure out which one was passed to `yarn add`
    this.flagToOrigin = [
      flags.dev && 'devDependencies',
      flags.optional && 'optionalDependencies',
      flags.peer && 'peerDependencies',
      'dependencies',
    ]
      .filter(Boolean)
      .shift();
  }

  args: Array<string>;
  flagToOrigin: string;
  addedPatterns: Array<string>;

  /**
   * TODO
   */

  prepareRequests(requests: DependencyRequestPatterns): DependencyRequestPatterns {
    const requestsWithArgs = requests.slice();

    for (const pattern of this.args) {
      requestsWithArgs.push({
        pattern,
        registry: 'npm',
        optional: false,
      });
    }
    return requestsWithArgs;
  }

  /**
   * returns version for a pattern based on Manifest
   */
  getPatternVersion(pattern: string, pkg: Manifest): string {
    const tilde = this.flags.tilde;
    const configPrefix = String(this.config.getOption('save-prefix'));
    const exact = this.flags.exact || Boolean(this.config.getOption('save-exact')) || configPrefix === '';
    const {hasVersion, range} = normalizePattern(pattern);
    let version;

    if (getExoticResolver(pattern)) {
      // wasn't a name/range tuple so this is just a raw exotic pattern
      version = pattern;
    } else if (hasVersion && range && (semver.satisfies(pkg.version, range) || getExoticResolver(range))) {
      // if the user specified a range then use it verbatim
      version = range;
    }

    if (!version || semver.valid(version)) {
      let prefix = configPrefix || '^';

      if (tilde) {
        prefix = '~';
      } else if (version || exact) {
        prefix = '';
      }
      version = `${prefix}${pkg.version}`;
    }

    return version;
  }

  preparePatterns(patterns: Array<string>): Array<string> {
    const preparedPatterns = patterns.slice();
    for (const pattern of this.resolver.dedupePatterns(this.args)) {
      const pkg = this.resolver.getResolvedPattern(pattern);
      invariant(pkg, `missing package ${pattern}`);
      const version = this.getPatternVersion(pattern, pkg);
      const newPattern = `${pkg.name}@${version}`;
      preparedPatterns.push(newPattern);
      this.addedPatterns.push(newPattern);
      if (newPattern === pattern) {
        continue;
      }
      this.resolver.replacePattern(pattern, newPattern);
    }
    return preparedPatterns;
  }

  preparePatternsForLinking(patterns: Array<string>, cwdManifest: Manifest, cwdIsRoot: boolean): Array<string> {
    // remove the newly added patterns if cwd != root and update the in-memory package dependency instead
    if (cwdIsRoot) {
      return patterns;
    }

    let manifest;
    const cwdPackage = `${cwdManifest.name}@${cwdManifest.version}`;
    try {
      manifest = this.resolver.getStrictResolvedPattern(cwdPackage);
    } catch (e) {
      this.reporter.warn(this.reporter.lang('unknownPackage', cwdPackage));
      return patterns;
    }

    let newPatterns = patterns;
    this._iterateAddedPackages((pattern, registry, dependencyType, pkgName, version) => {
      // remove added package from patterns list
      const filtered = newPatterns.filter(p => p !== pattern);
      invariant(
        newPatterns.length - filtered.length > 0,
        `expect added pattern '${pattern}' in the list: ${patterns.toString()}`,
      );
      newPatterns = filtered;

      // add new package into in-memory manifest so they can be linked properly
      manifest[dependencyType] = manifest[dependencyType] || {};
      if (manifest[dependencyType][pkgName] === version) {
        // package already existed
        return;
      }

      // update dependencies in the manifest
      invariant(manifest._reference, 'manifest._reference should not be null');
      const ref: Object = manifest._reference;

      ref['dependencies'] = ref['dependencies'] || [];
      ref['dependencies'].push(pattern);
    });

    return newPatterns;
  }

  async bailout(patterns: Array<string>, workspaceLayout: ?WorkspaceLayout): Promise<boolean> {
    const lockfileCache = this.lockfile.cache;
    if (!lockfileCache) {
      return false;
    }
    const match = await this.integrityChecker.check(patterns, lockfileCache, this.flags, workspaceLayout);
    const haveLockfile = await fs.exists(path.join(this.config.lockfileFolder, constants.LOCKFILE_FILENAME));
    if (match.integrityFileMissing && haveLockfile) {
      // Integrity file missing, force script installations
      this.scripts.setForce(true);
    }
    return false;
  }

  /**
   * Description
   */

  async init(): Promise<Array<string>> {
    const isWorkspaceRoot = this.config.workspaceRootFolder && this.config.cwd === this.config.workspaceRootFolder;

    // running "yarn add something" in a workspace root is often a mistake
    if (isWorkspaceRoot && !this.flags.ignoreWorkspaceRootCheck) {
      throw new MessageError(this.reporter.lang('workspacesAddRootCheck'));
    }

    this.addedPatterns = [];
    const patterns = await Install.prototype.init.call(this);
    await this.maybeOutputSaveTree(patterns);
    return patterns;
  }

  async applyChanges(manifests: RootManifests): Promise<boolean> {
    await Install.prototype.applyChanges.call(this, manifests);

    // fill rootPatternsToOrigin without `excludePatterns`
    await Install.prototype.fetchRequestFromCwd.call(this);

    this._iterateAddedPackages((pattern, registry, dependencyType, pkgName, version) => {
      // add it to manifest
      const {object} = manifests[registry];

      object[dependencyType] = object[dependencyType] || {};
      object[dependencyType][pkgName] = version;
      if (
        SILENCE_DEPENDENCY_TYPE_WARNINGS.indexOf(this.config.commandName) === -1 &&
        dependencyType !== this.flagToOrigin
      ) {
        this.reporter.warn(this.reporter.lang('moduleAlreadyInManifest', pkgName, dependencyType, this.flagToOrigin));
      }
    });

    return true;
  }

  /**
   * Description
   */

  fetchRequestFromCwd(): Promise<InstallCwdRequest> {
    return Install.prototype.fetchRequestFromCwd.call(this, this.args);
  }

  /**
   * Output a tree of any newly added dependencies.
   */

  async maybeOutputSaveTree(patterns: Array<string>): Promise<void> {
    // don't limit the shown tree depth
    const opts: ListOptions = {
      reqDepth: 0,
    };

    // restore the original patterns
    const merged = [...patterns, ...this.addedPatterns];

    const {trees, count} = await buildTree(this.resolver, this.linker, merged, opts, true, true);

    if (count === 1) {
      this.reporter.success(this.reporter.lang('savedNewDependency'));
    } else {
      this.reporter.success(this.reporter.lang('savedNewDependencies', count));
    }

    if (!count) {
      return;
    }

    const resolverPatterns = new Set();
    for (const pattern of patterns) {
      const {version, name} = this.resolver.getResolvedPattern(pattern) || {};
      resolverPatterns.add(`${name}@${version}`);
    }
    const directRequireDependencies = trees.filter(({name}) => resolverPatterns.has(name));

    this.reporter.info(this.reporter.lang('directDependencies'));
    this.reporter.tree('newDirectDependencies', directRequireDependencies);
    this.reporter.info(this.reporter.lang('allDependencies'));
    this.reporter.tree('newAllDependencies', trees);
  }

  /**
   * Save added packages to manifest if any of the --save flags were used.
   */

  async savePackages(): Promise<void> {}

  _iterateAddedPackages(
    f: (pattern: string, registry: RegistryNames, dependencyType: string, pkgName: string, version: string) => void,
  ) {
    const patternOrigins = Object.keys(this.rootPatternsToOrigin);

    // add new patterns to their appropriate registry manifest
    for (const pattern of this.addedPatterns) {
      const pkg = this.resolver.getResolvedPattern(pattern);
      invariant(pkg, `missing package ${pattern}`);
      const version = this.getPatternVersion(pattern, pkg);
      const ref = pkg._reference;
      invariant(ref, 'expected package reference');
      // lookup the package to determine dependency type; used during `yarn upgrade`
      const depType = patternOrigins.reduce((acc, prev) => {
        if (prev.indexOf(`${pkg.name}@`) === 0) {
          return this.rootPatternsToOrigin[prev];
        }
        return acc;
      }, null);

      // depType is calculated when `yarn upgrade` command is used
      const target = depType || this.flagToOrigin;

      f(pattern, ref.registry, target, pkg.name, version);
    }
  }
}

export function hasWrapper(commander: Object): boolean {
  return true;
}

export function setFlags(commander: Object) {
  commander.description('Installs a package and any packages that it depends on.');
  commander.usage('add [packages ...] [flags]');
  commander.option('-W, --ignore-workspace-root-check', 'required to run yarn add inside a workspace root');
  commander.option('-D, --dev', 'save package to your `devDependencies`');
  commander.option('-P, --peer', 'save package to your `peerDependencies`');
  commander.option('-O, --optional', 'save package to your `optionalDependencies`');
  commander.option('-E, --exact', 'install exact version');
  commander.option('-T, --tilde', 'install most recent release with the same minor version');
  commander.option('-A, --audit', 'Run vulnerability audit on installed packages');
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (!args.length) {
    throw new MessageError(reporter.lang('missingAddDependencies'));
  }

  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);

  await wrapLifecycle(config, flags, async () => {
    const install = new Add(args, flags, config, reporter, lockfile);
    await install.init();
  });
}
