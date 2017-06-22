/* @flow */

import type {RegistryNames, ConfigRegistries} from './registries/index.js';
import type {Reporter} from './reporters/index.js';
import type {Manifest, PackageRemote, WorkspacesManifestMap} from './types.js';
import type PackageReference from './package-reference.js';
import {execFromManifest} from './util/execute-lifecycle-script.js';
import {expandPath} from './util/path.js';
import normalizeManifest from './util/normalize-manifest/index.js';
import {MessageError} from './errors.js';
import * as fs from './util/fs.js';
import * as constants from './constants.js';
import ConstraintResolver from './package-constraint-resolver.js';
import RequestManager from './util/request-manager.js';
import {registries, registryNames} from './registries/index.js';
import {NoopReporter} from './reporters/index.js';
import map from './util/map.js';

const detectIndent = require('detect-indent');
const invariant = require('invariant');
const path = require('path');

export type ConfigOptions = {
  cwd?: ?string,
  _cacheRootFolder?: ?string,
  cacheFolder?: ?string,
  tempFolder?: ?string,
  modulesFolder?: ?string,
  globalFolder?: ?string,
  linkFolder?: ?string,
  offline?: boolean,
  preferOffline?: boolean,
  pruneOfflineMirror?: boolean,
  enableMetaFolder?: boolean,
  linkFileDependencies?: boolean,
  captureHar?: boolean,
  ignoreScripts?: boolean,
  ignorePlatform?: boolean,
  ignoreEngines?: boolean,
  cafile?: ?string,
  production?: boolean,
  disablePrepublish?: boolean,
  binLinks?: boolean,
  networkConcurrency?: number,
  childConcurrency?: number,
  networkTimeout?: number,
  nonInteractive?: boolean,
  scriptsPrependNodePath?: boolean,

  // Loosely compare semver for invalid cases like "0.01.0"
  looseSemver?: ?boolean,

  httpProxy?: ?string,
  httpsProxy?: ?string,

  commandName?: ?string,
};

type PackageMetadata = {
  artifacts: Array<string>,
  registry: RegistryNames,
  hash: string,
  remote: ?PackageRemote,
  package: Manifest,
};

type RootManifests = {
  [registryName: RegistryNames]: {
    loc: string,
    indent: ?string,
    object: Object,
    exists: boolean,
  },
};

function sortObject(object: Object): Object {
  const sortedObject = {};
  Object.keys(object).sort().forEach(item => {
    sortedObject[item] = object[item];
  });
  return sortedObject;
}

export default class Config {
  constructor(reporter: Reporter) {
    this.constraintResolver = new ConstraintResolver(this, reporter);
    this.requestManager = new RequestManager(reporter);
    this.reporter = reporter;
    this._init({});
  }

  //
  looseSemver: boolean;
  offline: boolean;
  preferOffline: boolean;
  pruneOfflineMirror: boolean;
  enableMetaFolder: boolean;
  enableLockfileVersions: boolean;
  linkFileDependencies: boolean;
  ignorePlatform: boolean;
  binLinks: boolean;

  //
  linkedModules: Array<string>;

  //
  rootModuleFolders: Array<string>;

  //
  linkFolder: string;

  //
  globalFolder: string;

  //
  constraintResolver: ConstraintResolver;

  networkConcurrency: number;

  childConcurrency: number;

  //
  networkTimeout: number;

  //
  requestManager: RequestManager;

  //
  modulesFolder: ?string;

  //
  _cacheRootFolder: string;

  //
  cacheFolder: string;

  //
  tempFolder: string;

  //
  reporter: Reporter;

  // Whether we should ignore executing lifecycle scripts
  ignoreScripts: boolean;

  production: boolean;

  disablePrepublish: boolean;

  nonInteractive: boolean;

  workspacesEnabled: boolean;

  //
  cwd: string;
  workspaceRootFolder: ?string;
  lockfileFolder: string;

  //
  registries: ConfigRegistries;
  registryFolders: Array<string>;

  //
  cache: {
    [key: string]: ?Promise<any>,
  };

  //
  commandName: string;

  /**
   * Execute a promise produced by factory if it doesn't exist in our cache with
   * the associated key.
   */

  getCache<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.cache[key];
    if (cached) {
      return cached;
    }

    return (this.cache[key] = factory().catch((err: mixed) => {
      this.cache[key] = null;
      throw err;
    }));
  }

  /**
   * Get a config option from our yarn config.
   */

  getOption(key: string, expand: boolean = true): mixed {
    const value = this.registries.yarn.getOption(key);

    if (expand && typeof value === 'string') {
      return expandPath(value);
    }

    return value;
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
    this._init(opts);

    this.workspaceRootFolder = await this.findWorkspaceRoot(this.cwd);
    this.lockfileFolder = this.workspaceRootFolder || this.cwd;

    await fs.mkdirp(this.globalFolder);
    await fs.mkdirp(this.linkFolder);

    this.linkedModules = [];

    const linkedModules = await fs.readdir(this.linkFolder);

    for (const dir of linkedModules) {
      const linkedPath = path.join(this.linkFolder, dir);

      if (dir[0] === '@') {
        // it's a scope, not a package
        const scopedLinked = await fs.readdir(linkedPath);
        this.linkedModules.push(...scopedLinked.map(scopedDir => path.join(dir, scopedDir)));
      } else {
        this.linkedModules.push(dir);
      }
    }

    for (const key of Object.keys(registries)) {
      const Registry = registries[key];

      // instantiate registry
      const registry = new Registry(this.cwd, this.registries, this.requestManager, this.reporter);
      await registry.init();

      this.registries[key] = registry;
      this.registryFolders.push(registry.folder);
      const rootModuleFolder = path.join(this.cwd, registry.folder);
      if (this.rootModuleFolders.indexOf(rootModuleFolder) < 0) {
        this.rootModuleFolders.push(rootModuleFolder);
      }
    }

    this.networkConcurrency =
      opts.networkConcurrency || Number(this.getOption('network-concurrency')) || constants.NETWORK_CONCURRENCY;

    this.childConcurrency =
      opts.childConcurrency ||
      Number(this.getOption('child-concurrency')) ||
      Number(process.env.CHILD_CONCURRENCY) ||
      constants.CHILD_CONCURRENCY;

    this.networkTimeout = opts.networkTimeout || Number(this.getOption('network-timeout')) || constants.NETWORK_TIMEOUT;

    this.requestManager.setOptions({
      userAgent: String(this.getOption('user-agent')),
      httpProxy: String(opts.httpProxy || this.getOption('proxy') || ''),
      httpsProxy: String(opts.httpsProxy || this.getOption('https-proxy') || ''),
      strictSSL: Boolean(this.getOption('strict-ssl')),
      ca: Array.prototype.concat(opts.ca || this.getOption('ca') || []).map(String),
      cafile: String(opts.cafile || this.getOption('cafile') || ''),
      cert: String(opts.cert || this.getOption('cert') || ''),
      key: String(opts.key || this.getOption('key') || ''),
      networkConcurrency: this.networkConcurrency,
      networkTimeout: this.networkTimeout,
    });
    this._cacheRootFolder = String(
      opts.cacheFolder || this.getOption('cache-folder') || constants.MODULE_CACHE_DIRECTORY,
    );
    this.workspacesEnabled = Boolean(this.getOption('workspaces-experimental'));

    this.pruneOfflineMirror = Boolean(this.getOption('yarn-offline-mirror-pruning'));
    this.enableMetaFolder = Boolean(this.getOption('enable-meta-folder'));
    this.enableLockfileVersions = Boolean(this.getOption('yarn-enable-lockfile-versions'));
    this.linkFileDependencies = Boolean(this.getOption('yarn-link-file-dependencies'));

    //init & create cacheFolder, tempFolder
    this.cacheFolder = path.join(this._cacheRootFolder, 'v' + String(constants.CACHE_VERSION));
    this.tempFolder = opts.tempFolder || path.join(this.cacheFolder, '.tmp');
    await fs.mkdirp(this.cacheFolder);
    await fs.mkdirp(this.tempFolder);

    if (opts.production === 'false') {
      this.production = false;
    } else if (
      this.getOption('production') ||
      (process.env.NODE_ENV === 'production' &&
        process.env.NPM_CONFIG_PRODUCTION !== 'false' &&
        process.env.YARN_PRODUCTION !== 'false')
    ) {
      this.production = true;
    } else {
      this.production = !!opts.production;
    }

    if (this.workspaceRootFolder && !this.workspacesEnabled) {
      throw new MessageError(this.reporter.lang('workspaceExperimentalDisabled'));
    }
  }

  _init(opts: ConfigOptions) {
    this.rootModuleFolders = [];
    this.registryFolders = [];
    this.linkedModules = [];

    this.registries = map();
    this.cache = map();
    this.cwd = opts.cwd || this.cwd || process.cwd();

    this.looseSemver = opts.looseSemver == undefined ? true : opts.looseSemver;

    this.commandName = opts.commandName || '';

    this.preferOffline = !!opts.preferOffline;
    this.modulesFolder = opts.modulesFolder;
    this.globalFolder = opts.globalFolder || constants.GLOBAL_MODULE_DIRECTORY;
    this.linkFolder = opts.linkFolder || constants.LINK_REGISTRY_DIRECTORY;
    this.offline = !!opts.offline;
    this.binLinks = !!opts.binLinks;

    this.ignorePlatform = !!opts.ignorePlatform;
    this.ignoreScripts = !!opts.ignoreScripts;

    this.disablePrepublish = !!opts.disablePrepublish;

    this.nonInteractive = !!opts.nonInteractive;

    this.requestManager.setOptions({
      offline: !!opts.offline && !opts.preferOffline,
      captureHar: !!opts.captureHar,
    });

    if (this.modulesFolder) {
      this.rootModuleFolders.push(this.modulesFolder);
    }
  }

  /**
   * Generate an absolute module path.
   */

  generateHardModulePath(pkg: ?PackageReference, ignoreLocation?: ?boolean): string {
    invariant(this.cacheFolder, 'No package root');
    invariant(pkg, 'Undefined package');

    if (pkg.location && !ignoreLocation) {
      return pkg.location;
    }

    let name = pkg.name;
    let uid = pkg.uid;
    if (pkg.registry) {
      name = `${pkg.registry}-${name}`;
    }

    const {hash} = pkg.remote;

    if (pkg.version && pkg.version !== pkg.uid) {
      uid = `${pkg.version}-${uid}`;
    } else if (hash) {
      uid += `-${hash}`;
    }

    return path.join(this.cacheFolder, `${name}-${uid}`);
  }

  /**
   * Execute lifecycle scripts in the specified directory. Ignoring when the --ignore-scripts flag has been
   * passed.
   */

  executeLifecycleScript(commandName: string, cwd?: string): Promise<void> {
    if (this.ignoreScripts) {
      return Promise.resolve();
    } else {
      return execFromManifest(this, commandName, cwd || this.cwd);
    }
  }

  /**
   * Generate an absolute temporary filename location based on the input filename.
   */

  getTemp(filename: string): string {
    invariant(this.tempFolder, 'No temp folder');
    return path.join(this.tempFolder, filename);
  }

  /**
   * Remote packages may be cached in a file system to be available for offline installation.
   * Second time the same package needs to be installed it will be loaded from there.
   * Given a package's filename, return a path in the offline mirror location.
   */

  getOfflineMirrorPath(packageFilename: ?string): ?string {
    let mirrorPath;

    for (const key of ['npm', 'yarn']) {
      const registry = this.registries[key];

      if (registry == null) {
        continue;
      }

      const registryMirrorPath = registry.config['yarn-offline-mirror'];

      if (registryMirrorPath === false) {
        return null;
      }

      if (registryMirrorPath == null) {
        continue;
      }

      mirrorPath = registryMirrorPath;
    }

    if (mirrorPath == null) {
      return null;
    }

    if (packageFilename == null) {
      return mirrorPath;
    }

    return path.join(mirrorPath, path.basename(packageFilename));
  }

  /**
   * Checker whether the folder input is a valid module folder. We output a yarn metadata
   * file when we've successfully setup a folder so use this as a marker.
   */

  async isValidModuleDest(dest: string): Promise<boolean> {
    if (!await fs.exists(dest)) {
      return false;
    }

    if (!await fs.exists(path.join(dest, constants.METADATA_FILENAME))) {
      return false;
    }

    return true;
  }

  /**
   * Read package metadata and normalized package info.
   */

  readPackageMetadata(dir: string): Promise<PackageMetadata> {
    return this.getCache(`metadata-${dir}`, async (): Promise<PackageMetadata> => {
      const metadata = await this.readJson(path.join(dir, constants.METADATA_FILENAME));
      const pkg = await this.readManifest(dir, metadata.registry);

      return {
        package: pkg,
        artifacts: metadata.artifacts || [],
        hash: metadata.hash,
        remote: metadata.remote,
        registry: metadata.registry,
      };
    });
  }

  /**
   * Read normalized package info according yarn-metadata.json
   * throw an error if package.json was not found
   */

  readManifest(dir: string, priorityRegistry?: RegistryNames, isRoot?: boolean = false): Promise<Manifest> {
    return this.getCache(`manifest-${dir}`, async (): Promise<Manifest> => {
      const manifest = await this.maybeReadManifest(dir, priorityRegistry, isRoot);

      if (manifest) {
        return manifest;
      } else {
        throw new MessageError(this.reporter.lang('couldntFindPackagejson', dir), 'ENOENT');
      }
    });
  }

  /**
 * try get the manifest file by looking
 * 1. manifest file in cache
 * 2. manifest file in registry
 */
  async maybeReadManifest(dir: string, priorityRegistry?: RegistryNames, isRoot?: boolean = false): Promise<?Manifest> {
    const metadataLoc = path.join(dir, constants.METADATA_FILENAME);

    if (await fs.exists(metadataLoc)) {
      const metadata = await this.readJson(metadataLoc);

      if (!priorityRegistry) {
        priorityRegistry = metadata.priorityRegistry;
      }

      if (typeof metadata.manifest !== 'undefined') {
        return metadata.manifest;
      }
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

    return null;
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
      const data = await this.readJson(loc);
      data._registry = registry;
      data._loc = loc;
      return normalizeManifest(data, dir, this, isRoot);
    } else {
      return null;
    }
  }

  async findManifest(dir: string, isRoot: boolean): Promise<?Manifest> {
    for (const registry of registryNames) {
      const manifest = await this.tryManifest(dir, registry, isRoot);

      if (manifest) {
        return manifest;
      }
    }

    return null;
  }

  async findWorkspaceRoot(initial: string): Promise<?string> {
    let previous = null;
    let current = path.normalize(initial);

    do {
      const manifest = await this.findManifest(current, true);

      if (manifest && manifest.workspaces) {
        return current;
      }

      previous = current;
      current = path.dirname(current);
    } while (current !== previous);

    return null;
  }

  async resolveWorkspaces(root: string, rootManifest: Manifest): Promise<WorkspacesManifestMap> {
    const workspaces = {};
    const patterns = rootManifest.workspaces || [];
    if (!this.workspacesEnabled) {
      return workspaces;
    }
    if (!rootManifest.private && patterns.length > 0) {
      throw new MessageError(this.reporter.lang('workspacesRequirePrivateProjects'));
    }

    const registryFilenames = registryNames.map(registryName => this.registries[registryName].constructor.filename);
    const trailingPattern = `/+(${registryFilenames.join(`|`)})`;

    const files = await Promise.all(
      patterns.map(pattern => {
        return fs.glob(pattern.replace(/\/?$/, trailingPattern), {cwd: root, ignore: this.registryFolders});
      }),
    );

    for (const file of new Set([].concat(...files))) {
      const loc = path.join(root, path.dirname(file));
      const manifest = await this.findManifest(loc, false);

      if (!manifest) {
        continue;
      }

      if (!manifest.name) {
        this.reporter.warn(this.reporter.lang('workspaceNameMandatory', loc));
        continue;
      }
      if (!manifest.version) {
        this.reporter.warn(this.reporter.lang('workspaceVersionMandatory', loc));
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(workspaces, manifest.name)) {
        throw new MessageError(this.reporter.lang('workspaceNameDuplicate', manifest.name));
      }

      workspaces[manifest.name] = {loc, manifest};
    }

    return workspaces;
  }

  /**
   * Description
   */

  getFolder(pkg: Manifest): string {
    let registryName = pkg._registry;
    if (!registryName) {
      const ref = pkg._reference;
      invariant(ref, 'expected reference');
      registryName = ref.registry;
    }
    return this.registries[registryName].folder;
  }

  /**
   * Get root manifests.
   */

  async getRootManifests(): Promise<RootManifests> {
    const manifests: RootManifests = {};
    for (const registryName of registryNames) {
      const registry = registries[registryName];
      const jsonLoc = path.join(this.cwd, registry.filename);

      let object = {};
      let exists = false;
      let indent;
      if (await fs.exists(jsonLoc)) {
        exists = true;

        const info = await this.readJson(jsonLoc, fs.readJsonAndFile);
        object = info.object;
        indent = detectIndent(info.content).indent || undefined;
      }
      manifests[registryName] = {loc: jsonLoc, object, exists, indent};
    }
    return manifests;
  }

  /**
   * Save root manifests.
   */

  async saveRootManifests(manifests: RootManifests): Promise<void> {
    for (const registryName of registryNames) {
      const {loc, object, exists, indent} = manifests[registryName];
      if (!exists && !Object.keys(object).length) {
        continue;
      }

      for (const field of constants.DEPENDENCY_TYPES) {
        if (object[field]) {
          object[field] = sortObject(object[field]);
        }
      }

      await fs.writeFilePreservingEol(loc, JSON.stringify(object, null, indent || constants.DEFAULT_INDENT) + '\n');
    }
  }

  /**
   * Call the passed factory (defaults to fs.readJson) and rethrow a pretty error message if it was the result
   * of a syntax error.
   */

  readJson(loc: string, factory: (filename: string) => Promise<Object> = fs.readJson): Promise<Object> {
    try {
      return factory(loc);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new MessageError(this.reporter.lang('jsonError', loc, err.message));
      } else {
        throw err;
      }
    }
  }

  static async create(opts: ConfigOptions = {}, reporter: Reporter = new NoopReporter()): Promise<Config> {
    const config = new Config(reporter);
    await config.init(opts);
    return config;
  }
}
