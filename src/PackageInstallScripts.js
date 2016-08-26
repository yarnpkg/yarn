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
import type {LifecycleReturn} from './util/execute-lifecycle-script.js';
import executeLifecycleScript from './util/execute-lifecycle-script.js';
import * as fs from './util/fs.js';
import * as constants from './constants.js';

const invariant = require('invariant');
const path = require('path');
const _ = require('lodash');

export default class PackageInstallScripts {
  constructor(config: Config, resolver: PackageResolver, force: boolean) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config = config;
    this.installedDependencies = 0;
    this.totalDependencies = 0;
    this.force = force;
  }

  needsPermission: boolean;
  resolver: PackageResolver;
  reporter: Reporter;
  config: Config;
  installedDependencies: number;
  totalDependencies: number;
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

  async wrapCopyBuildArtifacts<T>(
    loc: string,
    pkg: Manifest,
    spinner: ReporterSpinner,
    factory: () => Promise<T>,
  ): Promise<T> {
    const beforeFiles = await this.walk(loc);
    const res = await factory();
    const afterFiles = await this.walk(loc);

    // work out what files have been created/modified
    const buildArtifacts = [];
    for (const [file, mtime] of afterFiles) {
      if (!beforeFiles.has(file) || beforeFiles.get(file) !== mtime) {
        buildArtifacts.push(file);
      }
    }

    // install script may have removed files, remove them from the cache too
    const removedFiles = [];
    for (const [file] of beforeFiles) {
      if (!afterFiles.has(file)) {
        removedFiles.push(file);
      }
    }

    if (!removedFiles.length && !buildArtifacts.length) {
      // nothing else to do here since we have no build side effects
      return res;
    }

    // if the process is killed while copying over build artifacts then we'll leave
    // the cache in a bad state. remove the metadata file and add it back once we've
    // done our copies to ensure cache integrity.
    const cachedLoc = this.config.generateHardModulePath(pkg._reference, true);
    const cachedMetadataLoc = path.join(cachedLoc, constants.METADATA_FILENAME);
    const cachedMetadata = await fs.readFile(cachedMetadataLoc);
    await fs.unlink(cachedMetadataLoc);

    // remove files that install script removed
    if (removedFiles.length) {
      for (let file of removedFiles) {
        await fs.unlink(path.join(cachedLoc, file));
      }
    }

    // copy over build artifacts to cache directory
    if (buildArtifacts.length) {
      const copyRequests = [];
      for (let file of buildArtifacts) {
        copyRequests.push({
          src: path.join(loc, file),
          dest: path.join(cachedLoc, file),
          onDone() {
            spinner.tick(`Cached build artifact ${file}`);
          },
        });
      }
      await fs.copyBulk(copyRequests, {
        possibleExtraneous: false,
      });
      await fs.writeFile(cachedMetadataLoc, cachedMetadata);
    }

    return res;
  }

  async install(cmds: Array<string>, pkg: Manifest, spinner: ReporterSpinner): LifecycleReturn {
    const loc = this.config.generateHardModulePath(pkg._reference);
    try {
      return this.wrapCopyBuildArtifacts(
        loc,
        pkg,
        spinner,
        (): LifecycleReturn => executeLifecycleScript(this.config, loc, cmds, spinner),
      );
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

  async runCMD(pkg: Manifest): Promise<void> {
    const cmds = this.getInstallCommands(pkg);
    if (!cmds.length) {
      return;
    }
    const ref = pkg._reference;
    invariant(ref, 'Missing package reference');
    if (!ref.fresh && !this.force) {
      // this package hasn't been touched
      return;
    }

    // we haven't actually written this module out
    if (ref.ignore) {
      return;
    }

    if (this.needsPermission && !ref.hasPermission('scripts')) {
      const can = await this.reporter.questionAffirm(
        `Module ${pkg.name} wants to execute the commands ${JSON.stringify(cmds)}. Do you want to accept?`,
      );
      if (!can) {
        return;
      }

      ref.setPermission('scripts', can);
    }
    const spinner = this.reporter.activityStep(this.installedDependencies, this.totalDependencies, pkg.name);
    await this.install(cmds, pkg, spinner);
    spinner.end();
  }

  // find the next package to be installed
  findInstallablePackage(workQueue: Set<Manifest>, installed: Set<Manifest>): ?Manifest {
    for (let pkg of workQueue) {
      const ref = pkg._reference;
      if (ref == null) {
        invariant(ref, 'expected reference');
      }
      const deps = ref.dependencies;
      let dependenciesFullfilled = true;
      for (let dep of deps) {
        const pkgDep = this.resolver.getStrictResolvedPattern(dep);
        if (!installed.has(pkgDep)) {
          dependenciesFullfilled = false;
          break;
        }
      }
      // all depedencies are installed
      if (dependenciesFullfilled) {
        return pkg;
      }
    }
    return null;
  }

  async worker(workQueue: Set<Manifest>, installed: Set<Manifest>, waitQueue: Set<Function>): Promise<void> {
    while (true) {
      // No more work to be done
      if (workQueue.size == 0) {
        break;
      }
      // find a installable package
      const pkg = this.findInstallablePackage(workQueue, installed);
      // can't find a package to install, register into waitQueue
      if (pkg == null) {
        await new Promise((resolve): Set<Function> => waitQueue.add(resolve));
        continue;
      }
      // found the package to install
      workQueue.delete(pkg);
      this.installedDependencies += 1;
      await this.runCMD(pkg);
      installed.add(pkg);
      for (let workerResolve of waitQueue) {
        workerResolve();
      }
      waitQueue.clear();
    }
  }

  async init(seedPatterns: Array<string>): Promise<void> {
    let pkgs: Iterable<Manifest> = this.resolver.getTopologicalManifests(seedPatterns);
    let workQueue = new Set(pkgs);
    this.totalDependencies = workQueue.size;

    let installed = new Set();
    // waitQueue acts like a semaphore to allow workers to register to be notified
    // when there are more work added to the work queue
    let waitQueue = new Set();
    // TODO: Make the number of workers configerable
    let workers = [];
    for (let i = 0; i < 4; i++) {
      workers.push(this.worker(workQueue, installed, waitQueue));
    }
    await Promise.all(workers);
  }
}
