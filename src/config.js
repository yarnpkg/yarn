/* @flow */

import type {RegistryNames} from './registries/index.js';
import type {Reporter} from './reporters/index.js';
import type Registry from './registries/base-registry.js';
import type {Manifest, PackageRemote} from './types.js';
import normaliseManifest from './util/normalise-manifest/index.js';
import * as fs from './util/fs.js';
import * as constants from './constants.js';
import ConstraintResolver from './package-constraint-resolver.js';
import RequestManager from './util/request-manager.js';
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
  captureHar?: boolean,
  ignoreEngines?: boolean,
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
    this.requestManager = new RequestManager(reporter, opts.offline && !opts.preferOffline, opts.captureHar);
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

  resolveConstraints(versions: Array<string>, range: string): Promise<?string> {
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

  getOfflineMirrorPath(tarUrl: ?string): ?string {
    let registry = this.registries.npm;
    if (registry == null) {
      return null;
    }

    //
    const mirrorPath = registry.config['yarn-offline-mirror'];
    if (mirrorPath == null) {
      return null;
    }

    //
    if (tarUrl == null) {
      return mirrorPath;
    }

    //
    const {pathname} = url.parse(tarUrl);
    if (pathname == null) {
      return mirrorPath;
    }

    //
    return path.join(mirrorPath, path.basename(pathname));
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

    // walk up from current directory looking for .yarn folders
    const parts = this.cwd.split(path.sep);
    for (let i = parts.length; i > 0; i--) {
      const loc = parts.slice(0, i).concat(constants.MODULE_CACHE_DIRECTORY).join(path.sep);
      if (await fs.exists(loc)) {
        return loc;
      }
    }

    // try and create ~/.yarn
    const loc = path.join(userHome, constants.MODULE_CACHE_DIRECTORY);
    await fs.mkdirp(loc);
    return loc;
  }

  /**
   * Checker whether the folder input is a valid module folder. We output a yarn metadata
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

  readPackageMetadata(dir: string): Promise<PackageMetadata> {
    return this.getCache(`metadata-${dir}`, async (): Promise<PackageMetadata> => {
      const metadata = await fs.readJson(path.join(dir, constants.METADATA_FILENAME));
      const pkg = await this.readManifest(dir, metadata.registry);

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

  readManifest(dir: string, priorityRegistry?: RegistryNames, isRoot?: boolean = false): Promise<Manifest> {
    return this.getCache(`manifest-${dir}`, async (): Promise<Manifest> => {
      const metadataLoc = path.join(dir, constants.METADATA_FILENAME);
      if (!priorityRegistry && await fs.exists(metadataLoc)) {
        ({registry: priorityRegistry} = await fs.readJson(metadataLoc));
      }

      if (priorityRegistry) {
        const file = await this.tryManifest(dir, priorityRegistry, isRoot);
        if (file) {
          return file;
        }
      }

      for (const registry of Object.keys(registries)) {
        if (priorityRegistry === registry) {
          continue;
        }

        const file = await this.tryManifest(dir, registry, isRoot);
        if (file) {
          return file;
        }
      }

      throw new Error(`Couldn't find a manifest in ${dir}`);
    });
  }

  /**
   * Read the root manifest.
   */

  readRootManifest(): Promise<Manifest> {
    return this.readManifest(this.cwd, 'npm', true);
  }

  /**
   * Try and find package info with the input directory and registry.
   */

  async tryManifest(dir: string, registry: RegistryNames, isRoot: boolean): Promise<?Manifest> {
    const {filename} = registries[registry];
    const loc = path.join(dir, filename);
    if (await fs.exists(loc)) {
      const data = await fs.readJson(loc);
      data._registry = registry;
      data._loc = loc;
      return normaliseManifest(data, dir, this, isRoot);
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
