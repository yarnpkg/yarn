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

import type { RegistryNames } from "./registries/index.js";
import type { Reporter } from "./reporters/index.js";
import type Registry from "./registries/_base.js";
import type { Manifest } from "./types.js";
import normaliseManifest from "./util/normalise-manifest/index.js";
import * as fs from "./util/fs.js";
import * as constants from "./constants.js";
import ConstraintResolver from "./package-constraint-resolver.js";
import RequestManager from "./util/request-manager.js";
import { registries } from "./registries/index.js";
import map from "./util/map.js";

let invariant = require("invariant");
let userHome  = require("user-home");
let path      = require("path");
let url       = require("url");

type ConfigOptions = {
  cwd?: string,
  packagesRoot?: string,
  tempFolder?: string,
  modulesFolder?: string
};

export default class Config {
  constructor(reporter: Reporter, opts?: ConfigOptions = {}) {
    this.constraintResolver = new ConstraintResolver(this, reporter);
    this.requestManager     = new RequestManager(reporter);
    this.reporter           = reporter;

    this.registries = map();
    this.cwd        = opts.cwd || process.cwd();

    this.modulesFolder = opts.modulesFolder || path.join(this.cwd, "node_modules");
    this.packagesRoot  = opts.packagesRoot;
    this.tempFolder    = opts.tempFolder;
  }

  //
  constraintResolver: ConstraintResolver;

  //
  requestManager: RequestManager;

  //
  modulesFolder: string;

  //
  packagesRoot: ?string;

  //
  tempFolder: ?string;

  //
  reporter: Reporter;

  //
  cwd: string;

  //
  registries: {
    [name: RegistryNames]: Registry
  };

  /**
   * Reduce a list of versions to a single one based on an input range.
   */

  resolveConstraints(versions: Array<string>, range: string): Promise<string> {
    return this.constraintResolver.reduce(versions, range);
  }

  /**
   * Initialise config. Fetch registry options, find package roots.
   */

  async init(opts: ConfigOptions = {}): Promise<void> {
    if (opts.cwd) {
      this.cwd = opts.cwd;
    }

    if (!this.packagesRoot) {
      this.packagesRoot = await this.getPackageRoot(opts);
    }

    if (!this.tempFolder) {
      this.tempFolder = await this.getTempFolder();
    }

    for (let key of Object.keys(registries)) {
      let Registry = registries[key];

      // instantiate registry
      let registry = new Registry(this.cwd);
      await registry.init();

      this.registries[key] = registry;
    }
  }

  /**
   * Generate an absolute module path in fbkpm_modules.
   */

  generateHardModulePath(pkg: ?{
    name: string,
    uid: string,
    version: string,
    registry: RegistryNames,
    location: ?string
  }): string {
    invariant(this.packagesRoot, "No package root");
    invariant(pkg, "Undefined package");
    invariant(pkg.name, "No name field in package");
    invariant(pkg.uid, "No uid field in package");
    if (pkg.location) return pkg.location;

    let name = pkg.name;
    let uid = pkg.uid;
    if (pkg.registry) {
      name = `${pkg.registry}-${name}`;
      uid = pkg.version || uid;
    }

    return path.join(this.packagesRoot, `${name}-${uid}`);
  }

  /**
   * Generate an absolute temporary filename location based on the input filename.
   */

  getTemp(filename: string): string {
    invariant(this.tempFolder, "No temp folder");
    return path.join(this.tempFolder, filename);
  }

  /**
   * Remote packages may be cached in a file system to be available for offline installation
   * Second time the same package needs to be installed it will be loaded from there
   */

  getOfflineMirrorPath(registryName: RegistryNames, tarUrl: ?string): string {
    let registry = this.registries[registryName];
    if (!registry) return "";

    //
    let mirrorPath = registry.config["kpm-offline-mirror"];
    if (!mirrorPath) return "";

    //
    if (!tarUrl) return mirrorPath;

    //
    let parsed = url.parse(tarUrl);
    if (!parsed || !parsed.pathname) return mirrorPath;

    //
    return path.join(mirrorPath, path.basename(parsed.pathname));
  }

  /**
   * Find temporary folder.
   */

  async getTempFolder(): Promise<string> {
    invariant(this.packagesRoot, "No package root");
    let folder = path.join(this.packagesRoot, ".tmp");
    await fs.mkdirp(folder);
    return folder;
  }

  /**
   * Find package folder to store modules in.
   */

  async getPackageRoot(opts: ConfigOptions): Promise<string> {
    if (opts.packagesRoot) {
      return opts.packagesRoot;
    }

    // walk up from current directory looking for .fbkpm folders
    let parts = this.cwd.split(path.sep);
    for (let i = parts.length; i > 0; i--) {
      let loc = parts.slice(0, i).concat(constants.MODULE_CACHE_DIRECTORY).join(path.sep);
      if (await fs.exists(loc)) return loc;
    }

    // try and create <cwd>/fbkpm_modules
    let loc = path.join(userHome, constants.MODULE_CACHE_DIRECTORY);
    await fs.mkdirp(loc);
    return loc;
  }

  /**
   * Checker whether the folder input is a valid module folder. We output a fbkpm metadata
   * file when we've successfully setup a folder so use this as a marker.
   */

  async isValidModuleDest(dest: string): Promise<boolean> {
    if (!(await fs.exists(dest))) {
      return false;
    }

    if (!(await fs.exists(path.join(dest, constants.METADATA_FILENAME)))) {
      return false;
    }

    return true;
  }

  /**
   * Read package metadata and normalised package info.
   */

  async readPackageMetadata(dir: string): Promise<{
    registry: RegistryNames,
    hash: string,
    package: Manifest
  }> {
    let metadata = await fs.readJson(path.join(dir, constants.METADATA_FILENAME));
    let pkg = await this.readManifest(dir, metadata.registry);

    return {
      package: pkg,
      hash: metadata.hash,
      registry: metadata.registry
    };
  }

  /**
   * Read normalised package info.
   */

  async readManifest(dir: string, priorityRegistry?: RegistryNames): Promise<Object> {
    let metadataLoc = path.join(dir, constants.METADATA_FILENAME);
    if (!priorityRegistry && await fs.exists(metadataLoc)) {
      ({ registry: priorityRegistry } = await fs.readJson(metadataLoc));
    }

    if (priorityRegistry) {
      let file = await this.tryManifest(dir, priorityRegistry);
      if (file) return file;
    }

    for (let registry of Object.keys(registries)) {
      if (priorityRegistry === registry) continue;

      let file = await this.tryManifest(dir, registry);
      if (file) return file;
    }

    throw new Error(`Couldn't find a package.json in ${dir}`);
  }

  /**
   * Try and find package info with the input directory and registry.
   */

  async tryManifest(dir: string, registry: RegistryNames): ?Object {
    let filenames = registries[registry].filenames;
    for (let filename of filenames) {
      let loc = path.join(dir, filename);
      if (await fs.exists(loc)) {
        let data = await fs.readJson(loc);
        data.registry = registry;

        // TODO: warn
        await normaliseManifest(data, dir);

        return data;
      }
    }
  }
}
