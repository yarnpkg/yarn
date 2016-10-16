/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {InstallCwdRequest, InstallPrepared} from './install.js';
import type {DependencyRequestPatterns} from '../../types.js';
import type Config from '../../config.js';
import Lockfile from '../../lockfile/wrapper.js';
import * as PackageReference from '../../package-reference.js';
import PackageRequest from '../../package-request.js';
import {buildTree} from './ls.js';
import {Install, _setFlags} from './install.js';
import {MessageError} from '../../errors.js';

const invariant = require('invariant');

export class Add extends Install {
  constructor(
    args: Array<string>,
    flags: Object,
    config: Config,
    reporter: Reporter,
    lockfile: Lockfile,
  ) {
    super(flags, config, reporter, lockfile);
    this.args = args;
  }

  args: Array<string>;

  /**
   * TODO
   */

  prepare(patterns: Array<string>, requests: DependencyRequestPatterns): Promise<InstallPrepared> {
    const requestsWithArgs = requests.slice();

    for (const pattern of this.args) {
      requestsWithArgs.push({
        pattern,
        registry: 'npm',
        visibility: PackageReference.USED,
        optional: false,
      });
    }

    return Promise.resolve({
      patterns: patterns.concat(this.args),
      requests: requestsWithArgs,
      skip: false,
    });
  }

  /**
   * Description
   */

  async init(): Promise<Array<string>> {
    const patterns = await Install.prototype.init.call(this);
    await this.maybeOutputSaveTree(patterns);
    await this.savePackages();
    return patterns;
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
    const {trees, count} = await buildTree(this.resolver, this.linker, patterns, true, true);
    this.reporter.success(
      count === 1 ?
        this.reporter.lang('savedNewDependency')
      :
        this.reporter.lang('savedNewDependencies', count),
    );
    this.reporter.tree('newDependencies', trees);
  }

  /**
   * Save added packages to manifest if any of the --save flags were used.
   */

  async savePackages(): Promise<void> {
    const {dev, exact, tilde, optional, peer} = this.flags;

    // get all the different registry manifests in this folder
    const manifests = await this.config.getRootManifests();

    // add new patterns to their appropriate registry manifest
    for (const pattern of this.resolver.dedupePatterns(this.args)) {
      const pkg = this.resolver.getResolvedPattern(pattern);
      invariant(pkg, `missing package ${pattern}`);

      const ref = pkg._reference;
      invariant(ref, 'expected package reference');

      const parts = PackageRequest.normalizePattern(pattern);
      let version;
      if (parts.hasVersion && parts.range) {
        // if the user specified a range then use it verbatim
        version = parts.range;
      } else if (PackageRequest.getExoticResolver(pattern)) {
        // wasn't a name/range tuple so this is just a raw exotic pattern
        version = pattern;
      } else if (tilde) { // --save-tilde
        version = `~${pkg.version}`;
      } else if (exact) { // --save-exact
        version = pkg.version;
      } else { // default to save prefix
        version = `${String(this.config.getOption('save-prefix'))}${pkg.version}`;
      }

      // build up list of objects to put ourselves into from the cli args
      const targetKeys: Array<string> = [];
      if (dev) {
        targetKeys.push('devDependencies');
      }
      if (peer) {
        targetKeys.push('peerDependencies');
      }
      if (optional) {
        targetKeys.push('optionalDependencies');
      }
      if (!targetKeys.length) {
        targetKeys.push('dependencies');
      }

      // add it to manifest
      const object = manifests[ref.registry].object;
      for (const key of targetKeys) {
        const target = object[key] = object[key] || {};
        target[pkg.name] = version;
      }

      // add pattern so it's aliased in the lockfile
      const newPattern = `${pkg.name}@${version}`;
      if (newPattern === pattern) {
        continue;
      }
      this.resolver.addPattern(newPattern, pkg);
      this.resolver.removePattern(pattern);
    }

    await this.config.saveRootManifests(manifests);
  }
}

export function setFlags(commander: Object) {
  commander.usage('add [packages ...] [flags]');
  _setFlags(commander);
  commander.option('--dev', 'save package to your `devDependencies`');
  commander.option('--peer', 'save package to your `peerDependencies`');
  commander.option('--optional', 'save package to your `optionalDependencies`');
  commander.option('--exact', '');
  commander.option('--tilde', '');
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  if (!args.length) {
    throw new MessageError(reporter.lang('missingAddDependencies'));
  }

  const lockfile = await Lockfile.fromDirectory(config.cwd, reporter);
  const install = new Add(args, flags, config, reporter, lockfile);
  await install.init();
}
