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

import type {Reporter} from '../../reporters/index.js';
import type {InstallCwdRequest, InstallPrepared} from './install.js';
import type {DependencyRequestPatterns} from '../../types.js';
import type Config from '../../config.js';
import Lockfile from '../../lockfile/wrapper.js';
import * as PackageReference from '../../package-reference.js';
import PackageRequest from '../../package-request.js';
import {registries} from '../../registries/index.js';
import {buildTree} from './ls.js';
import {Install} from './install.js';

let invariant = require('invariant');

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

  async prepare(patterns: Array<string>, requests: DependencyRequestPatterns): Promise<InstallPrepared> {
    let requestsWithArgs = requests.slice();

    for (let pattern of this.args) {
      requestsWithArgs.push({
        pattern,
        registry: 'npm',
        visibility: PackageReference.USED,
        optional: false,
      });
    }

    return {
      patterns: patterns.concat(this.args),
      requests: requestsWithArgs,
      skip: false,
    };
  }

  /**
   * Description
   */

  async init(): Promise<Array<string>> {
    let patterns = await Install.prototype.init.call(this);
    await this.maybeOutputSaveTree(patterns);
    await this.savePackages();
    return patterns;
  }

  /**
   * Description
   */

  async fetchRequestFromCwd(): Promise<InstallCwdRequest> {
    return Install.prototype.fetchRequestFromCwd.call(this, this.args);
  }

  /**
   * Output a tree of any newly added dependencies.
   */

  async maybeOutputSaveTree(patterns: Array<string>): Promise<void> {
    let {trees, count} = await buildTree(this.resolver, this.linker, patterns, true, true);
    this.reporter.success(`Saved ${count} new ${count === 1 ? 'dependency' : 'dependencies'}`);
    this.reporter.tree('newDependencies', trees);
  }

  /**
   * Save added packages to manifest if any of the --save flags were used.
   */

  async savePackages(): Promise<void> {
    let {dev, exact, tilde, optional, peer} = this.flags;

    // get all the different registry manifests in this folder
    let jsons = await this.getRootManifests();

    // add new patterns to their appropriate registry manifest
    for (const pattern of this.resolver.dedupePatterns(this.args)) {
      const pkg = this.resolver.getResolvedPattern(pattern);
      invariant(pkg, `missing package ${pattern}`);

      const ref = pkg._reference;
      invariant(ref, 'expected package reference');

      const parts = PackageRequest.normalisePattern(pattern);
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
      } else { // default to caret
        version = `^${pkg.version}`;
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
      const json = jsons[ref.registry][1];
      for (const key of targetKeys) {
        const target = json[key] = json[key] || {};
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

    await this.saveRootManifests(jsons);
  }
}

export function setFlags(commander: Object) {
  commander.usage('add [packages ...] [flags]');
  commander.option('--force', '');
  commander.option('-D, --dev', 'save package to your `devDependencies`');
  commander.option('-P, --peer', 'save package to your `peerDependencies`');
  commander.option('-O, --optional', 'save package to your `optionalDependencies`');
  commander.option('-E, --exact', '');
  commander.option('-T, --tilde', '');
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  let lockfile = await Lockfile.fromDirectory(config.cwd, reporter);
  const install = new Add(args, flags, config, reporter, lockfile);
  await install.init();
}
