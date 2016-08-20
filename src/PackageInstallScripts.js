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

import type {Manifest} from './types.js';
import type PackageResolver from './PackageResolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {ReporterSpinner} from './reporters/types.js';
import executeLifecycleScript from './util/execute-lifecycle-script.js';
import * as fs from './util/fs.js';

const invariant = require('invariant');
const path = require('path');
const _ = require('lodash');

export default class PackageInstallScripts {
  constructor(config: Config, resolver: PackageResolver, force: boolean) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config = config;
    this.force = force;
  }

  needsPermission: boolean;
  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;
  force: boolean;

  getInstallCommands(pkg: Manifest): Array<string> {
    const scripts = pkg.scripts;
    if (scripts) {
      return _.compact([scripts.preinstall, scripts.install, scripts.postinstall]);
    } else {
      return [];
    }
  }

  async walk(loc: string): Promise<Map<string, number>> {
    let files = await fs.walk(loc, null, this.config.registryFolders);
    let mtimes = new Map();
    for (let file of files) {
      mtimes.set(file.relative, file.mtime);
    }
    return mtimes;
  }

  async install(cmds: Array<string>, pkg: Manifest, spinner: ReporterSpinner): Promise<Array<{
    cwd: string,
    command: string,
    stdout: string,
  }>> {
    const loc = this.config.generateHardModulePath(pkg._reference);
    try {
      let beforeFiles = await this.walk(loc);
      let res = await executeLifecycleScript(this.config, loc, cmds, spinner);
      let afterFiles = await this.walk(loc);

      // work out what files have been created/modified
      let buildArtifacts = [];
      for (let [file, mtime] of afterFiles) {
        if (!beforeFiles.has(file) || beforeFiles.get(file) !== mtime) {
          buildArtifacts.push(file);
        }
      }

      // copy over build artifacts to cache directory
      if (buildArtifacts.length) {
        const cachedLoc = this.config.generateHardModulePath(pkg._reference, true);
        const copyRequests = [];
        for (let file of buildArtifacts) {
          copyRequests.push({
            src: path.join(loc, file),
            dest: path.join(cachedLoc, file),
          });
        }
        await fs.copyBulk(copyRequests);
      }

      return res;
    } catch (err) {
      err.message = `${loc}: ${err.message}`;

      const ref = pkg._reference;
      invariant(ref, 'expected reference');

      if (ref.optional) {
        this.reporter.error(`Error running install script for optional dependency: ${err.message}`);
        this.reporter.info('This module is OPTIONAL, you can safely ignore this error');
        return [];
      } else {
        // TODO log all stderr maybe?
        throw err;
      }
    }
  }

  async init(seedPatterns: Array<string>): Promise<void> {
    // get list of packages in topological order
    let pkgs: Iterable<Manifest> = this.resolver.getTopologicalManifests(seedPatterns);

    // refine packages to just those that have install scripts
    const refinedInfos = [];
    for (const pkg of pkgs) {
      const cmds = this.getInstallCommands(pkg);
      if (!cmds.length) {
        continue;
      }

      const ref = pkg._reference;
      invariant(ref, 'Missing package reference');
      if (!ref.fresh && !this.force) {
        // this package hasn't been touched
        continue;
      }

      // we haven't actually written this module out
      if (ref.ignore) {
        continue;
      }

      if (this.needsPermission && !ref.hasPermission('scripts')) {
        const can = await this.reporter.questionAffirm(
          `Module ${pkg.name} wants to execute the commands ${JSON.stringify(cmds)}. Do you want to accept?`,
        );
        if (!can) {
          continue;
        }

        ref.setPermission('scripts', can);
      }

      refinedInfos.push({pkg, cmds});
    }

    // nothing to install
    if (!refinedInfos.length) {
      return;
    }

    // run install scripts
    let i = 0;
    for (let {pkg, cmds} of refinedInfos) {
      i++;
      const spinner = this.reporter.activityStep(i, refinedInfos.length, pkg.name);
      await this.install(cmds, pkg, spinner);
      spinner.end();
    }
  }
}
