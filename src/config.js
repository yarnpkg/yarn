/* @flow */

import type {RegistryNames, ConfigRegistries} from './registries/index.js';
import type {Reporter} from './reporters/index.js';
import type {Manifest, PackageRemote, WorkspacesManifestMap, WorkspacesConfig} from './types.js';
import type PackageReference from './package-reference.js';
import {execFromManifest} from './util/execute-lifecycle-script.js';
import {resolveWithHome} from './util/path.js';
import {boolifyWithDefault} from './util/conversion.js';
import normalizeManifest from './util/normalize-manifest/index.js';
import {MessageError} from './errors.js';
import * as fs from './util/fs.js';
import * as constants from './constants.js';
import ConstraintResolver from './package-constraint-resolver.js';
import RequestManager from './util/request-manager.js';
import {registries, registryNames} from './registries/index.js';
import {NoopReporter} from './reporters/index.js';
import map from './util/map.js';

const crypto = require('crypto');
const detectIndent = require('detect-indent');
const invariant = require('invariant');
const path = require('path');
const micromatch = require('micromatch');
const isCi = require('is-ci');

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
  enablePnp?: boolean,
  disablePnp?: boolean,
  offlineCacheFolder?: string,

  enableDefaultRc?: boolean,
  extraneousYarnrcFiles?: Array<string>,

  // Loosely compare semver for invalid cases like "0.01.0"
  looseSemver?: ?boolean,

  httpProxy?: ?string,
  httpsProxy?: ?string,

  commandName?: ?string,
  registry?: ?string,

  updateChecksums?: boolean,

  focus?: boolean,

  otp?: string,
};

type PackageMetadata = {
  artifacts: Array<string>,
  registry: RegistryNames,
  hash: string,
  remote: ?PackageRemote,
  package: Manifest,
};

export type RootManifests = {
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
  enableDefaultRc: boolean;
  extraneousYarnrcFiles: Array<string>;

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
  updateChecksums: boolean;

  // cache packages in offline mirror folder as new .tgz files
  packBuiltPackages: boolean;

  //
  linkedModules: Array<string>;

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

  plugnplayPersist: boolean;
  plugnplayEnabled: boolean;
  plugnplayShebang: ?string;
  plugnplayBlacklist: ?string;
  plugnplayUnplugged: Array<string>;
  plugnplayPurgeUnpluggedPackages: boolean;

  workspacesEnabled: boolean;
  workspacesNohoistEnabled: boolean;

  offlineCacheFolder: ?string;

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

  focus: boolean;
  focusedWorkspaceName: string;

  autoAddIntegrity: boolean;

  otp: ?string;

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

  getOption(key: string, resolve: boolean = false): mixed {
    const value = this.registries.yarn.getOption(key);

    if (resolve && typeof value === 'string' && value.length) {
      return resolveWithHome(value);
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

    // using focus in a workspace root is not allowed
    if (this.focus && (!this.workspaceRootFolder || this.cwd === this.workspaceRootFolder)) {
      throw new MessageError(this.reporter.lang('workspacesFocusRootCheck'));
    }

    if (this.focus) {
      const focusedWorkspaceManifest = await this.readRootManifest();
      this.focusedWorkspaceName = focusedWorkspaceManifest.name;
    }

    this.linkedModules = [];

    let linkedModules;
    try {
      linkedModules = await fs.readdir(this.linkFolder);
    } catch (err) {
      if (err.code === 'ENOENT') {
        linkedModules = [];
      } else {
        throw err;
      }
    }

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

      const extraneousRcFiles = Registry === registries.yarn ? this.extraneousYarnrcFiles : [];

      // instantiate registry
      const registry = new Registry(
        this.cwd,
        this.registries,
        this.requestManager,
        this.reporter,
        this.enableDefaultRc,
        extraneousRcFiles,
      );
      await registry.init({
        registry: opts.registry,
      });

      this.registries[key] = registry;
      if (this.registryFolders.indexOf(registry.folder) === -1) {
        this.registryFolders.push(registry.folder);
      }
    }

    if (this.modulesFolder) {
      this.registryFolders = [this.modulesFolder];
    }

    this.networkConcurrency =
      opts.networkConcurrency || Number(this.getOption('network-concurrency')) || constants.NETWORK_CONCURRENCY;

    this.childConcurrency =
      opts.childConcurrency ||
      Number(this.getOption('child-concurrency')) ||
      Number(process.env.CHILD_CONCURRENCY) ||
      constants.CHILD_CONCURRENCY;

    this.networkTimeout = opts.networkTimeout || Number(this.getOption('network-timeout')) || constants.NETWORK_TIMEOUT;

    const httpProxy = opts.httpProxy || this.getOption('proxy');
    const httpsProxy = opts.httpsProxy || this.getOption('https-proxy');
    this.requestManager.setOptions({
      userAgent: String(this.getOption('user-agent')),
      httpProxy: httpProxy === false ? false : String(httpProxy || ''),
      httpsProxy: httpsProxy === false ? false : String(httpsProxy || ''),
      strictSSL: Boolean(this.getOption('strict-ssl')),
      ca: Array.prototype.concat(opts.ca || this.getOption('ca') || []).map(String),
      cafile: String(opts.cafile || this.getOption('cafile', true) || ''),
      cert: String(opts.cert || this.getOption('cert') || ''),
      key: String(opts.key || this.getOption('key') || ''),
      networkConcurrency: this.networkConcurrency,
      networkTimeout: this.networkTimeout,
    });

    this.globalFolder = opts.globalFolder || String(this.getOption('global-folder', true));
    if (this.globalFolder === 'undefined') {
      this.globalFolder = constants.GLOBAL_MODULE_DIRECTORY;
    }

    let cacheRootFolder = opts.cacheFolder || this.getOption('cache-folder', true);

    if (!cacheRootFolder) {
      let preferredCacheFolders = constants.PREFERRED_MODULE_CACHE_DIRECTORIES;
      const preferredCacheFolder = opts.preferredCacheFolder || this.getOption('preferred-cache-folder', true);

      if (preferredCacheFolder) {
        preferredCacheFolders = [String(preferredCacheFolder)].concat(preferredCacheFolders);
      }

      const cacheFolderQuery = await fs.getFirstSuitableFolder(
        preferredCacheFolders,
        fs.constants.W_OK | fs.constants.X_OK | fs.constants.R_OK, // eslint-disable-line no-bitwise
      );
      for (const skippedEntry of cacheFolderQuery.skipped) {
        this.reporter.warn(this.reporter.lang('cacheFolderSkipped', skippedEntry.folder));
      }

      cacheRootFolder = cacheFolderQuery.folder;
      if (cacheRootFolder && cacheFolderQuery.skipped.length > 0) {
        this.reporter.warn(this.reporter.lang('cacheFolderSelected', cacheRootFolder));
      }
    }

    if (!cacheRootFolder) {
      throw new MessageError(this.reporter.lang('cacheFolderMissing'));
    } else {
      this._cacheRootFolder = String(cacheRootFolder);
    }

    const manifest = await this.maybeReadManifest(this.lockfileFolder);

    const plugnplayByEnv = this.getOption('plugnplay-override');
    if (plugnplayByEnv != null) {
      this.plugnplayEnabled = plugnplayByEnv !== 'false' && plugnplayByEnv !== '0';
      this.plugnplayPersist = false;
    } else if (opts.enablePnp || opts.disablePnp) {
      this.plugnplayEnabled = !!opts.enablePnp;
      this.plugnplayPersist = true;
    } else if (manifest && manifest.installConfig && manifest.installConfig.pnp) {
      this.plugnplayEnabled = !!manifest.installConfig.pnp;
      this.plugnplayPersist = false;
    } else {
      this.plugnplayEnabled = false;
      this.plugnplayPersist = false;
    }

    if (process.platform === 'win32') {
      const cacheRootFolderDrive = path.parse(this._cacheRootFolder).root.toLowerCase();
      const lockfileFolderDrive = path.parse(this.lockfileFolder).root.toLowerCase();

      if (cacheRootFolderDrive !== lockfileFolderDrive) {
        if (this.plugnplayEnabled) {
          this.reporter.warn(this.reporter.lang('plugnplayWindowsSupport'));
        }
        this.plugnplayEnabled = false;
        this.plugnplayPersist = false;
      }
    }

    this.plugnplayShebang = String(this.getOption('plugnplay-shebang') || '') || '/usr/bin/env node';
    this.plugnplayBlacklist = String(this.getOption('plugnplay-blacklist') || '') || null;

    this.ignoreScripts = opts.ignoreScripts || Boolean(this.getOption('ignore-scripts', false));

    this.workspacesEnabled = this.getOption('workspaces-experimental') !== false;
    this.workspacesNohoistEnabled = this.getOption('workspaces-nohoist-experimental') !== false;

    this.offlineCacheFolder = String(this.getOption('offline-cache-folder') || '') || null;

    this.pruneOfflineMirror = Boolean(this.getOption('yarn-offline-mirror-pruning'));
    this.enableMetaFolder = Boolean(this.getOption('enable-meta-folder'));
    this.enableLockfileVersions = Boolean(this.getOption('yarn-enable-lockfile-versions'));
    this.linkFileDependencies = Boolean(this.getOption('yarn-link-file-dependencies'));
    this.packBuiltPackages = Boolean(this.getOption('experimental-pack-script-packages-in-mirror'));

    this.autoAddIntegrity = !boolifyWithDefault(String(this.getOption('unsafe-disable-integrity-migration')), true);

    //init & create cacheFolder, tempFolder
    this.cacheFolder = path.join(this._cacheRootFolder, 'v' + String(constants.CACHE_VERSION));
    this.tempFolder = opts.tempFolder || path.join(this.cacheFolder, '.tmp');
    await fs.mkdirp(this.cacheFolder);
    await fs.mkdirp(this.tempFolder);

    if (opts.production !== undefined) {
      this.production = Boolean(opts.production);
    } else {
      this.production =
        Boolean(this.getOption('production')) ||
        (process.env.NODE_ENV === 'production' &&
          process.env.NPM_CONFIG_PRODUCTION !== 'false' &&
          process.env.YARN_PRODUCTION !== 'false');
    }

    if (this.workspaceRootFolder && !this.workspacesEnabled) {
      throw new MessageError(this.reporter.lang('workspacesDisabled'));
    }
  }

  _init(opts: ConfigOptions) {
    this.registryFolders = [];
    this.linkedModules = [];

    this.registries = map();
    this.cache = map();

    // Ensure the cwd is always an absolute path.
    this.cwd = path.resolve(opts.cwd || this.cwd || process.cwd());

    this.looseSemver = opts.looseSemver == undefined ? true : opts.looseSemver;

    this.commandName = opts.commandName || '';

    this.enableDefaultRc = opts.enableDefaultRc !== false;
    this.extraneousYarnrcFiles = opts.extraneousYarnrcFiles || [];

    this.preferOffline = !!opts.preferOffline;
    this.modulesFolder = opts.modulesFolder;
    this.linkFolder = opts.linkFolder || constants.LINK_REGISTRY_DIRECTORY;
    this.offline = !!opts.offline;
    this.binLinks = !!opts.binLinks;
    this.updateChecksums = !!opts.updateChecksums;
    this.plugnplayUnplugged = [];
    this.plugnplayPurgeUnpluggedPackages = false;

    this.ignorePlatform = !!opts.ignorePlatform;
    this.ignoreScripts = !!opts.ignoreScripts;

    this.disablePrepublish = !!opts.disablePrepublish;

    // $FlowFixMe$
    this.nonInteractive = !!opts.nonInteractive || isCi || !process.stdout.isTTY;

    this.requestManager.setOptions({
      offline: !!opts.offline && !opts.preferOffline,
      captureHar: !!opts.captureHar,
    });

    this.focus = !!opts.focus;
    this.focusedWorkspaceName = '';

    this.otp = opts.otp || '';
  }

  /**
   * Generate a name suitable as unique filesystem identifier for the specified package.
   */

  generateUniquePackageSlug(pkg: PackageReference): string {
    let slug = pkg.name;

    slug = slug.replace(/[^@a-z0-9]+/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');

    if (pkg.registry) {
      slug = `${pkg.registry}-${slug}`;
    } else {
      slug = `unknown-${slug}`;
    }

    const {hash} = pkg.remote;

    if (pkg.version) {
      slug += `-${pkg.version}`;
    }

    if (pkg.uid && pkg.version !== pkg.uid) {
      slug += `-${pkg.uid}`;
    } else if (hash) {
      slug += `-${hash}`;
    }

    if (pkg.remote.integrity) {
      slug += `-integrity`;
    }

    return slug;
  }

  /**
   * Generate an absolute module path.
   */

  generateModuleCachePath(pkg: ?PackageReference): string {
    invariant(this.cacheFolder, 'No package root');
    invariant(pkg, 'Undefined package');

    const slug = this.generateUniquePackageSlug(pkg);
    return path.join(this.cacheFolder, slug, 'node_modules', pkg.name);
  }

  /**
   */

  getUnpluggedPath(): string {
    return path.join(this.lockfileFolder, '.pnp', 'unplugged');
  }

  /**
    */

  generatePackageUnpluggedPath(pkg: PackageReference): string {
    const slug = this.generateUniquePackageSlug(pkg);
    return path.join(this.getUnpluggedPath(), slug, 'node_modules', pkg.name);
  }

  /**
   */

  async listUnpluggedPackageFolders(): Promise<Map<string, string>> {
    const unpluggedPackages = new Map();
    const unpluggedPath = this.getUnpluggedPath();

    if (!await fs.exists(unpluggedPath)) {
      return unpluggedPackages;
    }

    for (const unpluggedName of await fs.readdir(unpluggedPath)) {
      const nmListing = await fs.readdir(path.join(unpluggedPath, unpluggedName, 'node_modules'));
      invariant(nmListing.length === 1, 'A single folder should be in the unplugged directory');

      const target = path.join(unpluggedPath, unpluggedName, `node_modules`, nmListing[0]);
      unpluggedPackages.set(unpluggedName, target);
    }

    return unpluggedPackages;
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
    if (!await fs.exists(current)) {
      throw new MessageError(this.reporter.lang('folderMissing', current));
    }

    do {
      const manifest = await this.findManifest(current, true);
      const ws = extractWorkspaces(manifest);
      if (ws && ws.packages) {
        const relativePath = path.relative(current, initial);
        if (relativePath === '' || micromatch([relativePath], ws.packages).length > 0) {
          return current;
        } else {
          return null;
        }
      }

      previous = current;
      current = path.dirname(current);
    } while (current !== previous);

    return null;
  }

  async resolveWorkspaces(root: string, rootManifest: Manifest): Promise<WorkspacesManifestMap> {
    const workspaces = {};
    if (!this.workspacesEnabled) {
      return workspaces;
    }

    const ws = this.getWorkspaces(rootManifest, true);
    const patterns = ws && ws.packages ? ws.packages : [];

    if (!Array.isArray(patterns)) {
      throw new MessageError(this.reporter.lang('workspacesSettingMustBeArray'));
    }

    const registryFilenames = registryNames
      .map(registryName => this.registries[registryName].constructor.filename)
      .join('|');
    const trailingPattern = `/+(${registryFilenames})`;
    // anything under folder (node_modules) should be ignored, thus use the '**' instead of shallow match "*"
    const ignorePatterns = this.registryFolders.map(folder => `/${folder}/**/+(${registryFilenames})`);

    const files = await Promise.all(
      patterns.map(pattern =>
        fs.glob(pattern.replace(/\/?$/, trailingPattern), {
          cwd: root,
          ignore: ignorePatterns.map(ignorePattern => pattern.replace(/\/?$/, ignorePattern)),
        }),
      ),
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

  // workspaces functions
  getWorkspaces(manifest: ?Manifest, shouldThrow: boolean = false): ?WorkspacesConfig {
    if (!manifest || !this.workspacesEnabled) {
      return undefined;
    }

    const ws = extractWorkspaces(manifest);

    if (!ws) {
      return ws;
    }

    // validate eligibility
    let wsCopy = {...ws};
    const warnings: Array<string> = [];
    const errors: Array<string> = [];

    // packages
    if (wsCopy.packages && wsCopy.packages.length > 0 && !manifest.private) {
      errors.push(this.reporter.lang('workspacesRequirePrivateProjects'));
      wsCopy = undefined;
    }
    // nohoist
    if (wsCopy && wsCopy.nohoist && wsCopy.nohoist.length > 0) {
      if (!this.workspacesNohoistEnabled) {
        warnings.push(this.reporter.lang('workspacesNohoistDisabled', manifest.name));
        wsCopy.nohoist = undefined;
      } else if (!manifest.private) {
        errors.push(this.reporter.lang('workspacesNohoistRequirePrivatePackages', manifest.name));
        wsCopy.nohoist = undefined;
      }
    }

    if (errors.length > 0 && shouldThrow) {
      throw new MessageError(errors.join('\n'));
    }

    const msg = errors.concat(warnings).join('\n');
    if (msg.length > 0) {
      this.reporter.warn(msg);
    }

    return wsCopy;
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

export function extractWorkspaces(manifest: ?Manifest): ?WorkspacesConfig {
  if (!manifest || !manifest.workspaces) {
    return undefined;
  }

  if (Array.isArray(manifest.workspaces)) {
    return {packages: manifest.workspaces};
  }

  if (
    (manifest.workspaces.packages && Array.isArray(manifest.workspaces.packages)) ||
    (manifest.workspaces.nohoist && Array.isArray(manifest.workspaces.nohoist))
  ) {
    return manifest.workspaces;
  }

  return undefined;
}
