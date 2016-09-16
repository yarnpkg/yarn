/* @flow */

import type {Manifest} from './types.js';
import type PackageResolver from './package-resolver.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {ReporterSetSpinner} from './reporters/types.js';
import executeLifecycleScript from './util/execute-lifecycle-script.js';
import * as fs from './util/fs.js';
import * as constants from './constants.js';

const invariant = require('invariant');
const path = require('path');
const _ = require('lodash');

export default class PackageInstallScripts {
  constructor(config: Config, resolver: PackageResolver, force: boolean) {
    this.installed = 0;
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config = config;
    this.force = force;
  }

  needsPermission: boolean;
  resolver: PackageResolver;
  reporter: Reporter;
  installed: number;
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

  async wrapCopyBuildArtifacts<T>(
    loc: string,
    pkg: Manifest,
    spinner: ReporterSetSpinner,
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

  async install(cmds: Array<string>, pkg: Manifest, spinner: ReporterSetSpinner): Promise<void> {
    const loc = this.config.generateHardModulePath(pkg._reference);
    try {
      await this.wrapCopyBuildArtifacts(
        loc,
        pkg,
        spinner,
        async (): Promise<void> => {
          for (let cmd of cmds) {
            await executeLifecycleScript(this.config, loc, cmd, spinner);
          }
        },
      );
    } catch (err) {
      err.message = `${loc}: ${err.message}`;

      const ref = pkg._reference;
      invariant(ref, 'expected reference');

      if (ref.optional) {
        this.reporter.error(this.reporter.lang('optionalModuleScriptFail', err.message));
        this.reporter.info(this.reporter.lang('optionalModuleFail'));
      } else {
        throw err;
      }
    }
  }

  packageCanBeInstalled(pkg: Manifest): boolean {
    const cmds = this.getInstallCommands(pkg);
    if (!cmds.length) {
      return false;
    }
    const ref = pkg._reference;
    invariant(ref, 'Missing package reference');
    if (!ref.fresh && !this.force) {
      // this package hasn't been touched
      return false;
    }

    // we haven't actually written this module out
    if (ref.ignore) {
      return false;
    }
    return true;
  }

  async runCommand(spinner: ReporterSetSpinner, pkg: Manifest): Promise<void> {
    const cmds = this.getInstallCommands(pkg);
    spinner.setPrefix(++this.installed, pkg.name);
    await this.install(cmds, pkg, spinner);
  }

  // find the next package to be installed
  findInstallablePackage(workQueue: Set<Manifest>, installed: Set<Manifest>): ?Manifest {
    for (let pkg of workQueue) {
      const ref = pkg._reference;
      invariant(ref, 'expected reference');

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

  async worker(
    spinner: ReporterSetSpinner,
    workQueue: Set<Manifest>,
    installed: Set<Manifest>,
    waitQueue: Set<Function>,
  ): Promise<void> {
    while (true) {
      // No more work to be done
      if (workQueue.size == 0) {
        break;
      }

      // find a installable package
      const pkg = this.findInstallablePackage(workQueue, installed);

      // can't find a package to install, register into waitQueue
      if (pkg == null) {
        spinner.clear();
        await new Promise((resolve): Set<Function> => waitQueue.add(resolve));
        continue;
      }

      // found a package to install
      workQueue.delete(pkg);
      await this.runCommand(spinner, pkg);
      installed.add(pkg);
      for (let workerResolve of waitQueue) {
        workerResolve();
      }
      waitQueue.clear();
    }
  }

  async init(seedPatterns: Array<string>): Promise<void> {
    let workQueue = new Set();
    let installed = new Set();
    let pkgs = this.resolver.getTopologicalManifests(seedPatterns);
    for (let pkg of pkgs) {
      if (this.packageCanBeInstalled(pkg)) {
        workQueue.add(pkg);
      } else {
        installed.add(pkg);
      }
    }

    // waitQueue acts like a semaphore to allow workers to register to be notified
    // when there are more work added to the work queue
    let waitQueue = new Set();
    let workers = [];

    const set = this.reporter.activitySet(workQueue.size, Math.min(constants.CHILD_CONCURRENCY, workQueue.size));

    for (let spinner of set.spinners) {
      workers.push(this.worker(spinner, workQueue, installed, waitQueue));
    }

    await Promise.all(workers);

    set.end();
  }
}
