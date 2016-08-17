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
import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import executeLifecycleScript from './util/execute-lifecycle-script.js';
import * as promise from './util/promise.js';

const invariant = require('invariant');
const _ = require('lodash');

export default class PackageInstallScripts {
  constructor(config: Config, resolver: PackageResolver, force: boolean) {
    this.resolver  = resolver;
    this.reporter  = config.reporter;
    this.config    = config;
    this.force     = force;
  }

  needsPermission: boolean;
  resolver: PackageResolver;
  reporter: Reporter;
  actions: Array<string>;
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

  async install(cmds: Array<string>, pkg: Manifest): Promise<Array<{
    cwd: string,
    command: string,
    stdout: string,
    stderr: string
  }>> {
    const loc = this.config.generateHardModulePath(pkg.reference);
    try {
      return await executeLifecycleScript(this.config, loc, cmds, pkg);
    } catch (err) {
      err.message = `${loc}: ${err.message}`;

      const ref = pkg.reference;
      invariant(ref, 'expected reference');

      if (ref.optional) {
        this.reporter.error(`Error running install script for optional dependency: ${err.message}`);
        this.reporter.info('This module is OPTIONAL, you can safely ignore this error');
        return [];
      } else {
        throw err;
      }
    }
  }

  async init(): Promise<void> {
    const pkgs = this.resolver.getManifests();

    // refine packages to those with install commands
    const refinedInfos = [];
    for (const pkg of pkgs) {
      const cmds = this.getInstallCommands(pkg);
      if (!cmds.length) {
        continue;
      }

      const ref = pkg.reference;
      invariant(ref, 'Missing package reference');
      if (!ref.fresh && !this.force) {
        continue;
      }

      if (this.needsPermission && !ref.hasPermission('scripts')) {
        const can = await this.reporter.question(
          `Module ${pkg.name} wants to execute the commands ${JSON.stringify(cmds)}. Do you want to accept?`,
        );
        if (!can) {
          continue;
        }

        ref.setPermission('scripts', can);
      }

      refinedInfos.push({pkg, cmds});
    }
    if (!refinedInfos.length) {
      return;
    }

    const tick = this.reporter.progress(refinedInfos.length);

    await promise.queue(refinedInfos, ({pkg, cmds}): Promise<void> => {
      return this.install(cmds, pkg).then(function() {
        tick(pkg.name);
      });
    });
  }
}
