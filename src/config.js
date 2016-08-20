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

import type {RegistryNames} from './registries/index.js';
import type {Reporter} from './reporters/index.js';
import type Registry from './registries/Registry.js';
import type {Manifest, PackageRemote} from './types.js';
import normaliseManifest from './util/normalise-manifest/index.js';
import * as fs from './util/fs.js';
import * as constants from './constants.js';
import ConstraintResolver from './PackageConstraintResolver.js';
import RequestManager from './util/RequestManager.js';
import {registries} from './registries/index.js';
import map from './util/map.js';

const invariant = require('invariant');
const userHome = require('user-home');
const path = require('path');
const url = require('url');

type ConfigOptions = {
  cwd?: string,
  packagesRoot?: string,
  tempFolder?: string,
  modulesFolder?: string,
  offline?: boolean,
  preferOffline?: boolean,
};

type PackageMetadata = {
  registry: RegistryNames,
  hash: string,
  remote: ?PackageRemote,
  package: Manifest
};

export default class Config {
  constructor(reporter: Reporter, opts?: ConfigOptions = {}) {
    this.constraintResolver = new ConstraintResolver(this, reporter);
    this.requestManager = new RequestManager(reporter, opts.offline && !opts.preferOffline);
    this.reporter = reporter;

    this.registryFolders = [];
    this.registries = map();
    this.cache = map();
    this.cwd = opts.cwd || process.cwd();

    this.preferOffline = !!opts.preferOffline;
    this.modulesFolder = opts.modulesFolder;
    this.packagesRoot = opts.packagesRoot;
    this.tempFolder = opts.tempFolder;
    this.offline = !!opts.offline;
  }

  //
  offline: boolean;
  preferOffline: boolean;

  //
  constraintResolver: ConstraintResolver;

  //
  requestManager: RequestManager;

  //
  modulesFolder: ?string;

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
  registryFolders: Array<string>;

  //
  cache: {
    [key: string]: ?Promise<any>
  };

  /**
   * Execute a promise produced by factory if it doesn't exist in our cache with
   * the associated key.
   */

  getCache<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.cache[key];
    if (cached) {
      return cached;
    }

    return this.cache[key] = factory().catch((err) => {
      this.cache[key] = null;
      throw err;
    });
  }

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

    for (const key of Object.keys(registries)) {
      const Registry = registries[key];

      // instantiate registry
      const registry = new Registry(this.cwd, this.requestManager);
      await registry.init();

      this.registries[key] = registry;
      this.registryFolders.push(registry.folder);
    }
  }

  /**
   * Generate an absolute module path.
   */

  generateHardModulePath(pkg: ?{
    name: string,
    uid: string,
    version: string,
    registry: RegistryNames,
    location: ?string
  }, ignoreLocation?: ?boolean): string {
    invariant(this.packagesRoot, 'No package root');
    invariant(pkg, 'Undefined package');
    invariant(pkg.name, 'No name field in package');
    invariant(pkg.uid, 'No uid field in package');
    if (pkg.location && !ignoreLocation) {
      return pkg.location;
    }

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
    invariant(this.tempFolder, 'No temp folder');
    return path.join(this.tempFolder, filename);
  }

  /**
   * Remote packages may be cached in a file system to be available for offline installation
   * Second time the same package needs to be installed it will be loaded from there
   */

  getOfflineMirrorPath(registryName: RegistryNames, tarUrl: ?string): string {
    const registry = this.registries[registryName];
    if (!registry) {
      return '';
    }

    //
    const mirrorPath = registry.config['kpm-offline-mirror'];
    if (!mirrorPath) {
      return '';
    }

    //
    if (!tarUrl) {
      return mirrorPath;
    }

    //
    const parsed = url.parse(tarUrl);
    if (!parsed || !parsed.pathname) {
      return mirrorPath;
    }

    //
    return path.join(mirrorPath, path.basename(parsed.pathname));
  }

  /**
   * Find temporary folder.
   */

  async getTempFolder(): Promise<string> {
    invariant(this.packagesRoot, 'No package root');
    const folder = path.join(this.packagesRoot, '.tmp');
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

    // walk up from current directory looking for .kpm folders
    const parts = this.cwd.split(path.sep);
    for (let i = parts.length; i > 0; i--) {
      const loc = parts.slice(0, i).concat(constants.MODULE_CACHE_DIRECTORY).join(path.sep);
      if (await fs.exists(loc)) {
        return loc;
      }
    }

    // try and create ~/.kpm
    const loc = path.join(userHome, constants.MODULE_CACHE_DIRECTORY);
    await fs.mkdirp(loc);
    return loc;
  }

  /**
   * Checker whether the folder input is a valid module folder. We output a kpm metadata
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

  async readPackageMetadata(dir: string): Promise<PackageMetadata> {
    const self = this;
    return this.getCache(`metadata-${dir}`, async function (): Promise<PackageMetadata> {
      const metadata = await fs.readJson(path.join(dir, constants.METADATA_FILENAME));
      const pkg = await self.readManifest(dir, metadata.registry);

      return {
        package: pkg,
        hash: metadata.hash,
        remote: metadata.remote,
        registry: metadata.registry,
      };
    });
  }

  /**
   * Read normalised package info.
   */

  async readManifest(dir: string, priorityRegistry?: RegistryNames): Promise<Object> {
    // TODO work out how priorityRegistry fits into this cache
    return this.getCache(`manifest-${dir}`, async (): Promise<Manifest> => {
      const metadataLoc = path.join(dir, constants.METADATA_FILENAME);
      if (!priorityRegistry && await fs.exists(metadataLoc)) {
        ({registry: priorityRegistry} = await fs.readJson(metadataLoc));
      }

      if (priorityRegistry) {
        const file = await this.tryManifest(dir, priorityRegistry);
        if (file) {
          return file;
        }
      }

      for (const registry of Object.keys(registries)) {
        if (priorityRegistry === registry) {
          continue;
        }

        const file = await this.tryManifest(dir, registry);
        if (file) {
          return file;
        }
      }

      throw new Error(`Couldn't find a manifest in ${dir}`);
    });
  }

  /**
   * Try and find package info with the input directory and registry.
   */

  async tryManifest(dir: string, registry: RegistryNames): ?Object {
    const {filename} = registries[registry];
    const loc = path.join(dir, filename);
    if (await fs.exists(loc)) {
      const data = await fs.readJson(loc);
      data._registry = registry;
      data._loc = loc;

      // TODO: warn
      await normaliseManifest(data, dir);

      return data;
    } else {
      return null;
    }
  }

  /**
   * Description
   */

  getFolder(pkg: Manifest): string {
    let registryName = pkg._registry;
    if (!registryName) {
      let ref = pkg._reference;
      invariant(ref, 'expected reference');
      registryName = ref.registry;
    }
    return this.registries[registryName].folder;
  }
}
