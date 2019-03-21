'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

exports.extractWorkspaces = extractWorkspaces;

var _executeLifecycleScript;

function _load_executeLifecycleScript() {
  return _executeLifecycleScript = require('./util/execute-lifecycle-script.js');
}

var _path;

function _load_path() {
  return _path = require('./util/path.js');
}

var _conversion;

function _load_conversion() {
  return _conversion = require('./util/conversion.js');
}

var _index;

function _load_index() {
  return _index = _interopRequireDefault(require('./util/normalize-manifest/index.js'));
}

var _errors;

function _load_errors() {
  return _errors = require('./errors.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./util/fs.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('./constants.js'));
}

var _packageConstraintResolver;

function _load_packageConstraintResolver() {
  return _packageConstraintResolver = _interopRequireDefault(require('./package-constraint-resolver.js'));
}

var _requestManager;

function _load_requestManager() {
  return _requestManager = _interopRequireDefault(require('./util/request-manager.js'));
}

var _index2;

function _load_index2() {
  return _index2 = require('./registries/index.js');
}

var _index3;

function _load_index3() {
  return _index3 = require('./reporters/index.js');
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('./util/map.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const detectIndent = require('detect-indent');
const invariant = require('invariant');
const path = require('path');
const micromatch = require('micromatch');
const isCi = require('is-ci');

function sortObject(object) {
  const sortedObject = {};
  Object.keys(object).sort().forEach(item => {
    sortedObject[item] = object[item];
  });
  return sortedObject;
}

class Config {
  constructor(reporter) {
    this.constraintResolver = new (_packageConstraintResolver || _load_packageConstraintResolver()).default(this, reporter);
    this.requestManager = new (_requestManager || _load_requestManager()).default(reporter);
    this.reporter = reporter;
    this._init({});
  }

  //


  //


  // cache packages in offline mirror folder as new .tgz files


  //


  //


  //


  //


  //


  //


  //


  //


  //


  //


  //


  // Whether we should ignore executing lifecycle scripts


  //


  //


  //


  //


  /**
   * Execute a promise produced by factory if it doesn't exist in our cache with
   * the associated key.
   */

  getCache(key, factory) {
    const cached = this.cache[key];
    if (cached) {
      return cached;
    }

    return this.cache[key] = factory().catch(err => {
      this.cache[key] = null;
      throw err;
    });
  }

  /**
   * Get a config option from our yarn config.
   */

  getOption(key, resolve = false) {
    const value = this.registries.yarn.getOption(key);

    if (resolve && typeof value === 'string' && value.length) {
      return (0, (_path || _load_path()).resolveWithHome)(value);
    }

    return value;
  }

  /**
   * Reduce a list of versions to a single one based on an input range.
   */

  resolveConstraints(versions, range) {
    return this.constraintResolver.reduce(versions, range);
  }

  /**
   * Initialise config. Fetch registry options, find package roots.
   */

  init(opts = {}) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this._init(opts);

      _this.workspaceRootFolder = yield _this.findWorkspaceRoot(_this.cwd);
      _this.lockfileFolder = _this.workspaceRootFolder || _this.cwd;

      // using focus in a workspace root is not allowed
      if (_this.focus && (!_this.workspaceRootFolder || _this.cwd === _this.workspaceRootFolder)) {
        throw new (_errors || _load_errors()).MessageError(_this.reporter.lang('workspacesFocusRootCheck'));
      }

      if (_this.focus) {
        const focusedWorkspaceManifest = yield _this.readRootManifest();
        _this.focusedWorkspaceName = focusedWorkspaceManifest.name;
      }

      _this.linkedModules = [];

      let linkedModules;
      try {
        linkedModules = yield (_fs || _load_fs()).readdir(_this.linkFolder);
      } catch (err) {
        if (err.code === 'ENOENT') {
          linkedModules = [];
        } else {
          throw err;
        }
      }

      for (var _iterator = linkedModules, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        const dir = _ref;

        const linkedPath = path.join(_this.linkFolder, dir);

        if (dir[0] === '@') {
          // it's a scope, not a package
          const scopedLinked = yield (_fs || _load_fs()).readdir(linkedPath);
          _this.linkedModules.push(...scopedLinked.map(function (scopedDir) {
            return path.join(dir, scopedDir);
          }));
        } else {
          _this.linkedModules.push(dir);
        }
      }

      for (var _iterator2 = Object.keys((_index2 || _load_index2()).registries), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref2;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref2 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref2 = _i2.value;
        }

        const key = _ref2;

        const Registry = (_index2 || _load_index2()).registries[key];

        const extraneousRcFiles = Registry === (_index2 || _load_index2()).registries.yarn ? _this.extraneousYarnrcFiles : [];

        // instantiate registry
        const registry = new Registry(_this.cwd, _this.registries, _this.requestManager, _this.reporter, _this.enableDefaultRc, extraneousRcFiles);
        yield registry.init({
          registry: opts.registry
        });

        _this.registries[key] = registry;
        if (_this.registryFolders.indexOf(registry.folder) === -1) {
          _this.registryFolders.push(registry.folder);
        }
      }

      if (_this.modulesFolder) {
        _this.registryFolders = [_this.modulesFolder];
      }

      _this.networkConcurrency = opts.networkConcurrency || Number(_this.getOption('network-concurrency')) || (_constants || _load_constants()).NETWORK_CONCURRENCY;

      _this.childConcurrency = opts.childConcurrency || Number(_this.getOption('child-concurrency')) || Number(process.env.CHILD_CONCURRENCY) || (_constants || _load_constants()).CHILD_CONCURRENCY;

      _this.networkTimeout = opts.networkTimeout || Number(_this.getOption('network-timeout')) || (_constants || _load_constants()).NETWORK_TIMEOUT;

      const httpProxy = opts.httpProxy || _this.getOption('proxy');
      const httpsProxy = opts.httpsProxy || _this.getOption('https-proxy');
      _this.requestManager.setOptions({
        userAgent: String(_this.getOption('user-agent')),
        httpProxy: httpProxy === false ? false : String(httpProxy || ''),
        httpsProxy: httpsProxy === false ? false : String(httpsProxy || ''),
        strictSSL: Boolean(_this.getOption('strict-ssl')),
        ca: Array.prototype.concat(opts.ca || _this.getOption('ca') || []).map(String),
        cafile: String(opts.cafile || _this.getOption('cafile', true) || ''),
        cert: String(opts.cert || _this.getOption('cert') || ''),
        key: String(opts.key || _this.getOption('key') || ''),
        networkConcurrency: _this.networkConcurrency,
        networkTimeout: _this.networkTimeout
      });

      _this.globalFolder = opts.globalFolder || String(_this.getOption('global-folder', true));
      if (_this.globalFolder === 'undefined') {
        _this.globalFolder = (_constants || _load_constants()).GLOBAL_MODULE_DIRECTORY;
      }

      let cacheRootFolder = opts.cacheFolder || _this.getOption('cache-folder', true);

      if (!cacheRootFolder) {
        let preferredCacheFolders = (_constants || _load_constants()).PREFERRED_MODULE_CACHE_DIRECTORIES;
        const preferredCacheFolder = opts.preferredCacheFolder || _this.getOption('preferred-cache-folder', true);

        if (preferredCacheFolder) {
          preferredCacheFolders = [String(preferredCacheFolder)].concat(preferredCacheFolders);
        }

        const cacheFolderQuery = yield (_fs || _load_fs()).getFirstSuitableFolder(preferredCacheFolders, (_fs || _load_fs()).constants.W_OK | (_fs || _load_fs()).constants.X_OK | (_fs || _load_fs()).constants.R_OK // eslint-disable-line no-bitwise
        );
        for (var _iterator3 = cacheFolderQuery.skipped, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
          var _ref3;

          if (_isArray3) {
            if (_i3 >= _iterator3.length) break;
            _ref3 = _iterator3[_i3++];
          } else {
            _i3 = _iterator3.next();
            if (_i3.done) break;
            _ref3 = _i3.value;
          }

          const skippedEntry = _ref3;

          _this.reporter.warn(_this.reporter.lang('cacheFolderSkipped', skippedEntry.folder));
        }

        cacheRootFolder = cacheFolderQuery.folder;
        if (cacheRootFolder && cacheFolderQuery.skipped.length > 0) {
          _this.reporter.warn(_this.reporter.lang('cacheFolderSelected', cacheRootFolder));
        }
      }

      if (!cacheRootFolder) {
        throw new (_errors || _load_errors()).MessageError(_this.reporter.lang('cacheFolderMissing'));
      } else {
        _this._cacheRootFolder = String(cacheRootFolder);
      }

      const manifest = yield _this.maybeReadManifest(_this.lockfileFolder);

      const plugnplayByEnv = _this.getOption('plugnplay-override');
      if (plugnplayByEnv != null) {
        _this.plugnplayEnabled = plugnplayByEnv !== 'false' && plugnplayByEnv !== '0';
        _this.plugnplayPersist = false;
      } else if (opts.enablePnp || opts.disablePnp) {
        _this.plugnplayEnabled = !!opts.enablePnp;
        _this.plugnplayPersist = true;
      } else if (manifest && manifest.installConfig && manifest.installConfig.pnp) {
        _this.plugnplayEnabled = !!manifest.installConfig.pnp;
        _this.plugnplayPersist = false;
      } else {
        _this.plugnplayEnabled = false;
        _this.plugnplayPersist = false;
      }

      if (process.platform === 'win32') {
        const cacheRootFolderDrive = path.parse(_this._cacheRootFolder).root.toLowerCase();
        const lockfileFolderDrive = path.parse(_this.lockfileFolder).root.toLowerCase();

        if (cacheRootFolderDrive !== lockfileFolderDrive) {
          if (_this.plugnplayEnabled) {
            _this.reporter.warn(_this.reporter.lang('plugnplayWindowsSupport'));
          }
          _this.plugnplayEnabled = false;
          _this.plugnplayPersist = false;
        }
      }

      _this.plugnplayShebang = String(_this.getOption('plugnplay-shebang') || '') || '/usr/bin/env node';
      _this.plugnplayBlacklist = String(_this.getOption('plugnplay-blacklist') || '') || null;

      _this.ignoreScripts = opts.ignoreScripts || Boolean(_this.getOption('ignore-scripts', false));

      _this.workspacesEnabled = _this.getOption('workspaces-experimental') !== false;
      _this.workspacesNohoistEnabled = _this.getOption('workspaces-nohoist-experimental') !== false;

      _this.offlineCacheFolder = String(_this.getOption('offline-cache-folder') || '') || null;

      _this.pruneOfflineMirror = Boolean(_this.getOption('yarn-offline-mirror-pruning'));
      _this.enableMetaFolder = Boolean(_this.getOption('enable-meta-folder'));
      _this.enableLockfileVersions = Boolean(_this.getOption('yarn-enable-lockfile-versions'));
      _this.linkFileDependencies = Boolean(_this.getOption('yarn-link-file-dependencies'));
      _this.packBuiltPackages = Boolean(_this.getOption('experimental-pack-script-packages-in-mirror'));

      _this.autoAddIntegrity = !(0, (_conversion || _load_conversion()).boolifyWithDefault)(String(_this.getOption('unsafe-disable-integrity-migration')), true);

      //init & create cacheFolder, tempFolder
      _this.cacheFolder = path.join(_this._cacheRootFolder, 'v' + String((_constants || _load_constants()).CACHE_VERSION));
      _this.tempFolder = opts.tempFolder || path.join(_this.cacheFolder, '.tmp');
      yield (_fs || _load_fs()).mkdirp(_this.cacheFolder);
      yield (_fs || _load_fs()).mkdirp(_this.tempFolder);

      if (opts.production !== undefined) {
        _this.production = Boolean(opts.production);
      } else {
        _this.production = Boolean(_this.getOption('production')) || process.env.NODE_ENV === 'production' && process.env.NPM_CONFIG_PRODUCTION !== 'false' && process.env.YARN_PRODUCTION !== 'false';
      }

      if (_this.workspaceRootFolder && !_this.workspacesEnabled) {
        throw new (_errors || _load_errors()).MessageError(_this.reporter.lang('workspacesDisabled'));
      }
    })();
  }

  _init(opts) {
    this.registryFolders = [];
    this.linkedModules = [];

    this.registries = (0, (_map || _load_map()).default)();
    this.cache = (0, (_map || _load_map()).default)();

    // Ensure the cwd is always an absolute path.
    this.cwd = path.resolve(opts.cwd || this.cwd || process.cwd());

    this.looseSemver = opts.looseSemver == undefined ? true : opts.looseSemver;

    this.commandName = opts.commandName || '';

    this.enableDefaultRc = opts.enableDefaultRc !== false;
    this.extraneousYarnrcFiles = opts.extraneousYarnrcFiles || [];

    this.preferOffline = !!opts.preferOffline;
    this.modulesFolder = opts.modulesFolder;
    this.linkFolder = opts.linkFolder || (_constants || _load_constants()).LINK_REGISTRY_DIRECTORY;
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
      captureHar: !!opts.captureHar
    });

    this.focus = !!opts.focus;
    this.focusedWorkspaceName = '';

    this.otp = opts.otp || '';
  }

  /**
   * Generate a name suitable as unique filesystem identifier for the specified package.
   */

  generateUniquePackageSlug(pkg) {
    let slug = pkg.name;

    slug = slug.replace(/[^@a-z0-9]+/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');

    if (pkg.registry) {
      slug = `${pkg.registry}-${slug}`;
    } else {
      slug = `unknown-${slug}`;
    }

    const hash = pkg.remote.hash;


    if (pkg.version) {
      slug += `-${pkg.version}`;
    }

    if (pkg.uid && pkg.version !== pkg.uid) {
      slug += `-${pkg.uid}`;
    } else if (hash) {
      slug += `-${hash}`;
    }

    return slug;
  }

  /**
   * Generate an absolute module path.
   */

  generateModuleCachePath(pkg) {
    invariant(this.cacheFolder, 'No package root');
    invariant(pkg, 'Undefined package');

    const slug = this.generateUniquePackageSlug(pkg);
    return path.join(this.cacheFolder, slug, 'node_modules', pkg.name);
  }

  /**
   */

  getUnpluggedPath() {
    return path.join(this.lockfileFolder, '.pnp', 'unplugged');
  }

  /**
    */

  generatePackageUnpluggedPath(pkg) {
    const slug = this.generateUniquePackageSlug(pkg);
    return path.join(this.getUnpluggedPath(), slug, 'node_modules', pkg.name);
  }

  /**
   */

  listUnpluggedPackageFolders() {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const unpluggedPackages = new Map();
      const unpluggedPath = _this2.getUnpluggedPath();

      if (!(yield (_fs || _load_fs()).exists(unpluggedPath))) {
        return unpluggedPackages;
      }

      for (var _iterator4 = yield (_fs || _load_fs()).readdir(unpluggedPath), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray4) {
          if (_i4 >= _iterator4.length) break;
          _ref4 = _iterator4[_i4++];
        } else {
          _i4 = _iterator4.next();
          if (_i4.done) break;
          _ref4 = _i4.value;
        }

        const unpluggedName = _ref4;

        const nmListing = yield (_fs || _load_fs()).readdir(path.join(unpluggedPath, unpluggedName, 'node_modules'));
        invariant(nmListing.length === 1, 'A single folder should be in the unplugged directory');

        const target = path.join(unpluggedPath, unpluggedName, `node_modules`, nmListing[0]);
        unpluggedPackages.set(unpluggedName, target);
      }

      return unpluggedPackages;
    })();
  }

  /**
   * Execute lifecycle scripts in the specified directory. Ignoring when the --ignore-scripts flag has been
   * passed.
   */

  executeLifecycleScript(commandName, cwd) {
    if (this.ignoreScripts) {
      return Promise.resolve();
    } else {
      return (0, (_executeLifecycleScript || _load_executeLifecycleScript()).execFromManifest)(this, commandName, cwd || this.cwd);
    }
  }

  /**
   * Generate an absolute temporary filename location based on the input filename.
   */

  getTemp(filename) {
    invariant(this.tempFolder, 'No temp folder');
    return path.join(this.tempFolder, filename);
  }

  /**
   * Remote packages may be cached in a file system to be available for offline installation.
   * Second time the same package needs to be installed it will be loaded from there.
   * Given a package's filename, return a path in the offline mirror location.
   */

  getOfflineMirrorPath(packageFilename) {
    let mirrorPath;

    var _arr = ['npm', 'yarn'];
    for (var _i5 = 0; _i5 < _arr.length; _i5++) {
      const key = _arr[_i5];
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

  isValidModuleDest(dest) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (!(yield (_fs || _load_fs()).exists(dest))) {
        return false;
      }

      if (!(yield (_fs || _load_fs()).exists(path.join(dest, (_constants || _load_constants()).METADATA_FILENAME)))) {
        return false;
      }

      return true;
    })();
  }

  /**
   * Read package metadata and normalized package info.
   */

  readPackageMetadata(dir) {
    var _this3 = this;

    return this.getCache(`metadata-${dir}`, (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const metadata = yield _this3.readJson(path.join(dir, (_constants || _load_constants()).METADATA_FILENAME));
      const pkg = yield _this3.readManifest(dir, metadata.registry);

      return {
        package: pkg,
        artifacts: metadata.artifacts || [],
        hash: metadata.hash,
        remote: metadata.remote,
        registry: metadata.registry
      };
    }));
  }

  /**
   * Read normalized package info according yarn-metadata.json
   * throw an error if package.json was not found
   */

  readManifest(dir, priorityRegistry, isRoot = false) {
    var _this4 = this;

    return this.getCache(`manifest-${dir}`, (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const manifest = yield _this4.maybeReadManifest(dir, priorityRegistry, isRoot);

      if (manifest) {
        return manifest;
      } else {
        throw new (_errors || _load_errors()).MessageError(_this4.reporter.lang('couldntFindPackagejson', dir), 'ENOENT');
      }
    }));
  }

  /**
   * try get the manifest file by looking
   * 1. manifest file in cache
   * 2. manifest file in registry
   */
  maybeReadManifest(dir, priorityRegistry, isRoot = false) {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const metadataLoc = path.join(dir, (_constants || _load_constants()).METADATA_FILENAME);

      if (yield (_fs || _load_fs()).exists(metadataLoc)) {
        const metadata = yield _this5.readJson(metadataLoc);

        if (!priorityRegistry) {
          priorityRegistry = metadata.priorityRegistry;
        }

        if (typeof metadata.manifest !== 'undefined') {
          return metadata.manifest;
        }
      }

      if (priorityRegistry) {
        const file = yield _this5.tryManifest(dir, priorityRegistry, isRoot);
        if (file) {
          return file;
        }
      }

      for (var _iterator5 = Object.keys((_index2 || _load_index2()).registries), _isArray5 = Array.isArray(_iterator5), _i6 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
        var _ref7;

        if (_isArray5) {
          if (_i6 >= _iterator5.length) break;
          _ref7 = _iterator5[_i6++];
        } else {
          _i6 = _iterator5.next();
          if (_i6.done) break;
          _ref7 = _i6.value;
        }

        const registry = _ref7;

        if (priorityRegistry === registry) {
          continue;
        }

        const file = yield _this5.tryManifest(dir, registry, isRoot);
        if (file) {
          return file;
        }
      }

      return null;
    })();
  }

  /**
   * Read the root manifest.
   */

  readRootManifest() {
    return this.readManifest(this.cwd, 'npm', true);
  }

  /**
   * Try and find package info with the input directory and registry.
   */

  tryManifest(dir, registry, isRoot) {
    var _this6 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const filename = (_index2 || _load_index2()).registries[registry].filename;

      const loc = path.join(dir, filename);
      if (yield (_fs || _load_fs()).exists(loc)) {
        const data = yield _this6.readJson(loc);
        data._registry = registry;
        data._loc = loc;
        return (0, (_index || _load_index()).default)(data, dir, _this6, isRoot);
      } else {
        return null;
      }
    })();
  }

  findManifest(dir, isRoot) {
    var _this7 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      for (var _iterator6 = (_index2 || _load_index2()).registryNames, _isArray6 = Array.isArray(_iterator6), _i7 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
        var _ref8;

        if (_isArray6) {
          if (_i7 >= _iterator6.length) break;
          _ref8 = _iterator6[_i7++];
        } else {
          _i7 = _iterator6.next();
          if (_i7.done) break;
          _ref8 = _i7.value;
        }

        const registry = _ref8;

        const manifest = yield _this7.tryManifest(dir, registry, isRoot);

        if (manifest) {
          return manifest;
        }
      }

      return null;
    })();
  }

  findWorkspaceRoot(initial) {
    var _this8 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let previous = null;
      let current = path.normalize(initial);
      if (!(yield (_fs || _load_fs()).exists(current))) {
        throw new (_errors || _load_errors()).MessageError(_this8.reporter.lang('folderMissing', current));
      }

      do {
        const manifest = yield _this8.findManifest(current, true);
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
    })();
  }

  resolveWorkspaces(root, rootManifest) {
    var _this9 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const workspaces = {};
      if (!_this9.workspacesEnabled) {
        return workspaces;
      }

      const ws = _this9.getWorkspaces(rootManifest, true);
      const patterns = ws && ws.packages ? ws.packages : [];

      if (!Array.isArray(patterns)) {
        throw new (_errors || _load_errors()).MessageError(_this9.reporter.lang('workspacesSettingMustBeArray'));
      }

      const registryFilenames = (_index2 || _load_index2()).registryNames.map(function (registryName) {
        return _this9.registries[registryName].constructor.filename;
      }).join('|');
      const trailingPattern = `/+(${registryFilenames})`;
      // anything under folder (node_modules) should be ignored, thus use the '**' instead of shallow match "*"
      const ignorePatterns = _this9.registryFolders.map(function (folder) {
        return `/${folder}/**/+(${registryFilenames})`;
      });

      const files = yield Promise.all(patterns.map(function (pattern) {
        return (_fs || _load_fs()).glob(pattern.replace(/\/?$/, trailingPattern), {
          cwd: root,
          ignore: ignorePatterns.map(function (ignorePattern) {
            return pattern.replace(/\/?$/, ignorePattern);
          })
        });
      }));

      for (var _iterator7 = new Set([].concat(...files)), _isArray7 = Array.isArray(_iterator7), _i8 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
        var _ref9;

        if (_isArray7) {
          if (_i8 >= _iterator7.length) break;
          _ref9 = _iterator7[_i8++];
        } else {
          _i8 = _iterator7.next();
          if (_i8.done) break;
          _ref9 = _i8.value;
        }

        const file = _ref9;

        const loc = path.join(root, path.dirname(file));
        const manifest = yield _this9.findManifest(loc, false);

        if (!manifest) {
          continue;
        }

        if (!manifest.name) {
          _this9.reporter.warn(_this9.reporter.lang('workspaceNameMandatory', loc));
          continue;
        }
        if (!manifest.version) {
          _this9.reporter.warn(_this9.reporter.lang('workspaceVersionMandatory', loc));
          continue;
        }

        if (Object.prototype.hasOwnProperty.call(workspaces, manifest.name)) {
          throw new (_errors || _load_errors()).MessageError(_this9.reporter.lang('workspaceNameDuplicate', manifest.name));
        }

        workspaces[manifest.name] = { loc, manifest };
      }

      return workspaces;
    })();
  }

  // workspaces functions
  getWorkspaces(manifest, shouldThrow = false) {
    if (!manifest || !this.workspacesEnabled) {
      return undefined;
    }

    const ws = extractWorkspaces(manifest);

    if (!ws) {
      return ws;
    }

    // validate eligibility
    let wsCopy = (0, (_extends2 || _load_extends()).default)({}, ws);
    const warnings = [];
    const errors = [];

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
      throw new (_errors || _load_errors()).MessageError(errors.join('\n'));
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

  getFolder(pkg) {
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

  getRootManifests() {
    var _this10 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const manifests = {};
      for (var _iterator8 = (_index2 || _load_index2()).registryNames, _isArray8 = Array.isArray(_iterator8), _i9 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
        var _ref10;

        if (_isArray8) {
          if (_i9 >= _iterator8.length) break;
          _ref10 = _iterator8[_i9++];
        } else {
          _i9 = _iterator8.next();
          if (_i9.done) break;
          _ref10 = _i9.value;
        }

        const registryName = _ref10;

        const registry = (_index2 || _load_index2()).registries[registryName];
        const jsonLoc = path.join(_this10.cwd, registry.filename);

        let object = {};
        let exists = false;
        let indent;
        if (yield (_fs || _load_fs()).exists(jsonLoc)) {
          exists = true;

          const info = yield _this10.readJson(jsonLoc, (_fs || _load_fs()).readJsonAndFile);
          object = info.object;
          indent = detectIndent(info.content).indent || undefined;
        }
        manifests[registryName] = { loc: jsonLoc, object, exists, indent };
      }
      return manifests;
    })();
  }

  /**
   * Save root manifests.
   */

  saveRootManifests(manifests) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      for (var _iterator9 = (_index2 || _load_index2()).registryNames, _isArray9 = Array.isArray(_iterator9), _i10 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
        var _ref11;

        if (_isArray9) {
          if (_i10 >= _iterator9.length) break;
          _ref11 = _iterator9[_i10++];
        } else {
          _i10 = _iterator9.next();
          if (_i10.done) break;
          _ref11 = _i10.value;
        }

        const registryName = _ref11;
        var _manifests$registryNa = manifests[registryName];
        const loc = _manifests$registryNa.loc,
              object = _manifests$registryNa.object,
              exists = _manifests$registryNa.exists,
              indent = _manifests$registryNa.indent;

        if (!exists && !Object.keys(object).length) {
          continue;
        }

        for (var _iterator10 = (_constants || _load_constants()).DEPENDENCY_TYPES, _isArray10 = Array.isArray(_iterator10), _i11 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
          var _ref12;

          if (_isArray10) {
            if (_i11 >= _iterator10.length) break;
            _ref12 = _iterator10[_i11++];
          } else {
            _i11 = _iterator10.next();
            if (_i11.done) break;
            _ref12 = _i11.value;
          }

          const field = _ref12;

          if (object[field]) {
            object[field] = sortObject(object[field]);
          }
        }

        yield (_fs || _load_fs()).writeFilePreservingEol(loc, JSON.stringify(object, null, indent || (_constants || _load_constants()).DEFAULT_INDENT) + '\n');
      }
    })();
  }

  /**
   * Call the passed factory (defaults to fs.readJson) and rethrow a pretty error message if it was the result
   * of a syntax error.
   */

  readJson(loc, factory = (_fs || _load_fs()).readJson) {
    try {
      return factory(loc);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new (_errors || _load_errors()).MessageError(this.reporter.lang('jsonError', loc, err.message));
      } else {
        throw err;
      }
    }
  }

  static create(opts = {}, reporter = new (_index3 || _load_index3()).NoopReporter()) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const config = new Config(reporter);
      yield config.init(opts);
      return config;
    })();
  }
}

exports.default = Config;
function extractWorkspaces(manifest) {
  if (!manifest || !manifest.workspaces) {
    return undefined;
  }

  if (Array.isArray(manifest.workspaces)) {
    return { packages: manifest.workspaces };
  }

  if (manifest.workspaces.packages && Array.isArray(manifest.workspaces.packages) || manifest.workspaces.nohoist && Array.isArray(manifest.workspaces.nohoist)) {
    return manifest.workspaces;
  }

  return undefined;
}