'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.wrapLifecycle = exports.run = exports.install = exports.Install = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let install = exports.install = (() => {
  var _ref29 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, lockfile) {
    yield wrapLifecycle(config, flags, (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const install = new Install(flags, config, reporter, lockfile);
      yield install.init();
    }));
  });

  return function install(_x7, _x8, _x9, _x10) {
    return _ref29.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref31 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    let lockfile;
    let error = 'installCommandRenamed';
    if (flags.lockfile === false) {
      lockfile = new (_lockfile || _load_lockfile()).default();
    } else {
      lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder, reporter);
    }

    if (args.length) {
      const exampleArgs = args.slice();

      if (flags.saveDev) {
        exampleArgs.push('--dev');
      }
      if (flags.savePeer) {
        exampleArgs.push('--peer');
      }
      if (flags.saveOptional) {
        exampleArgs.push('--optional');
      }
      if (flags.saveExact) {
        exampleArgs.push('--exact');
      }
      if (flags.saveTilde) {
        exampleArgs.push('--tilde');
      }
      let command = 'add';
      if (flags.global) {
        error = 'globalFlagRemoved';
        command = 'global add';
      }
      throw new (_errors || _load_errors()).MessageError(reporter.lang(error, `yarn ${command} ${exampleArgs.join(' ')}`));
    }

    yield install(config, reporter, flags, lockfile);
  });

  return function run(_x11, _x12, _x13, _x14) {
    return _ref31.apply(this, arguments);
  };
})();

let wrapLifecycle = exports.wrapLifecycle = (() => {
  var _ref32 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, flags, factory) {
    yield config.executeLifecycleScript('preinstall');

    yield factory();

    // npm behaviour, seems kinda funky but yay compatibility
    yield config.executeLifecycleScript('install');
    yield config.executeLifecycleScript('postinstall');

    if (!config.production) {
      if (!config.disablePrepublish) {
        yield config.executeLifecycleScript('prepublish');
      }
      yield config.executeLifecycleScript('prepare');
    }
  });

  return function wrapLifecycle(_x15, _x16, _x17) {
    return _ref32.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _hooks;

function _load_hooks() {
  return _hooks = require('../../util/hooks.js');
}

var _index;

function _load_index() {
  return _index = _interopRequireDefault(require('../../util/normalize-manifest/index.js'));
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _integrityChecker;

function _load_integrityChecker() {
  return _integrityChecker = _interopRequireDefault(require('../../integrity-checker.js'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _lockfile2;

function _load_lockfile2() {
  return _lockfile2 = require('../../lockfile');
}

var _packageFetcher;

function _load_packageFetcher() {
  return _packageFetcher = _interopRequireWildcard(require('../../package-fetcher.js'));
}

var _packageInstallScripts;

function _load_packageInstallScripts() {
  return _packageInstallScripts = _interopRequireDefault(require('../../package-install-scripts.js'));
}

var _packageCompatibility;

function _load_packageCompatibility() {
  return _packageCompatibility = _interopRequireWildcard(require('../../package-compatibility.js'));
}

var _packageResolver;

function _load_packageResolver() {
  return _packageResolver = _interopRequireDefault(require('../../package-resolver.js'));
}

var _packageLinker;

function _load_packageLinker() {
  return _packageLinker = _interopRequireDefault(require('../../package-linker.js'));
}

var _index2;

function _load_index2() {
  return _index2 = require('../../registries/index.js');
}

var _index3;

function _load_index3() {
  return _index3 = require('../../resolvers/index.js');
}

var _autoclean;

function _load_autoclean() {
  return _autoclean = require('./autoclean.js');
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../../constants.js'));
}

var _normalizePattern;

function _load_normalizePattern() {
  return _normalizePattern = require('../../util/normalize-pattern.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('../../util/map.js'));
}

var _yarnVersion;

function _load_yarnVersion() {
  return _yarnVersion = require('../../util/yarn-version.js');
}

var _generatePnpMap;

function _load_generatePnpMap() {
  return _generatePnpMap = require('../../util/generate-pnp-map.js');
}

var _workspaceLayout;

function _load_workspaceLayout() {
  return _workspaceLayout = _interopRequireDefault(require('../../workspace-layout.js'));
}

var _resolutionMap;

function _load_resolutionMap() {
  return _resolutionMap = _interopRequireDefault(require('../../resolution-map.js'));
}

var _guessName;

function _load_guessName() {
  return _guessName = _interopRequireDefault(require('../../util/guess-name'));
}

var _audit;

function _load_audit() {
  return _audit = _interopRequireDefault(require('./audit'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const deepEqual = require('deep-equal');

const emoji = require('node-emoji');
const invariant = require('invariant');
const path = require('path');
const semver = require('semver');
const uuid = require('uuid');
const ssri = require('ssri');

const ONE_DAY = 1000 * 60 * 60 * 24;

/**
 * Try and detect the installation method for Yarn and provide a command to update it with.
 */

function getUpdateCommand(installationMethod) {
  if (installationMethod === 'tar') {
    return `curl --compressed -o- -L ${(_constants || _load_constants()).YARN_INSTALLER_SH} | bash`;
  }

  if (installationMethod === 'homebrew') {
    return 'brew upgrade yarn';
  }

  if (installationMethod === 'deb') {
    return 'sudo apt-get update && sudo apt-get install yarn';
  }

  if (installationMethod === 'rpm') {
    return 'sudo yum install yarn';
  }

  if (installationMethod === 'npm') {
    return 'npm install --global yarn';
  }

  if (installationMethod === 'chocolatey') {
    return 'choco upgrade yarn';
  }

  if (installationMethod === 'apk') {
    return 'apk update && apk add -u yarn';
  }

  return null;
}

function getUpdateInstaller(installationMethod) {
  // Windows
  if (installationMethod === 'msi') {
    return (_constants || _load_constants()).YARN_INSTALLER_MSI;
  }

  return null;
}

function normalizeFlags(config, rawFlags) {
  const flags = {
    // install
    har: !!rawFlags.har,
    ignorePlatform: !!rawFlags.ignorePlatform,
    ignoreEngines: !!rawFlags.ignoreEngines,
    ignoreScripts: !!rawFlags.ignoreScripts,
    ignoreOptional: !!rawFlags.ignoreOptional,
    force: !!rawFlags.force,
    flat: !!rawFlags.flat,
    lockfile: rawFlags.lockfile !== false,
    pureLockfile: !!rawFlags.pureLockfile,
    updateChecksums: !!rawFlags.updateChecksums,
    skipIntegrityCheck: !!rawFlags.skipIntegrityCheck,
    frozenLockfile: !!rawFlags.frozenLockfile,
    linkDuplicates: !!rawFlags.linkDuplicates,
    checkFiles: !!rawFlags.checkFiles,
    audit: !!rawFlags.audit,

    // add
    peer: !!rawFlags.peer,
    dev: !!rawFlags.dev,
    optional: !!rawFlags.optional,
    exact: !!rawFlags.exact,
    tilde: !!rawFlags.tilde,
    ignoreWorkspaceRootCheck: !!rawFlags.ignoreWorkspaceRootCheck,

    // outdated, update-interactive
    includeWorkspaceDeps: !!rawFlags.includeWorkspaceDeps,

    // add, remove, update
    workspaceRootIsCwd: rawFlags.workspaceRootIsCwd !== false
  };

  if (config.getOption('ignore-scripts')) {
    flags.ignoreScripts = true;
  }

  if (config.getOption('ignore-platform')) {
    flags.ignorePlatform = true;
  }

  if (config.getOption('ignore-engines')) {
    flags.ignoreEngines = true;
  }

  if (config.getOption('ignore-optional')) {
    flags.ignoreOptional = true;
  }

  if (config.getOption('force')) {
    flags.force = true;
  }

  return flags;
}

class Install {
  constructor(flags, config, reporter, lockfile) {
    this.rootManifestRegistries = [];
    this.rootPatternsToOrigin = (0, (_map || _load_map()).default)();
    this.lockfile = lockfile;
    this.reporter = reporter;
    this.config = config;
    this.flags = normalizeFlags(config, flags);
    this.resolutions = (0, (_map || _load_map()).default)(); // Legacy resolutions field used for flat install mode
    this.resolutionMap = new (_resolutionMap || _load_resolutionMap()).default(config); // Selective resolutions for nested dependencies
    this.resolver = new (_packageResolver || _load_packageResolver()).default(config, lockfile, this.resolutionMap);
    this.integrityChecker = new (_integrityChecker || _load_integrityChecker()).default(config);
    this.linker = new (_packageLinker || _load_packageLinker()).default(config, this.resolver);
    this.scripts = new (_packageInstallScripts || _load_packageInstallScripts()).default(config, this.resolver, this.flags.force);
  }

  /**
   * Create a list of dependency requests from the current directories manifests.
   */

  fetchRequestFromCwd(excludePatterns = [], ignoreUnusedPatterns = false) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const patterns = [];
      const deps = [];
      let resolutionDeps = [];
      const manifest = {};

      const ignorePatterns = [];
      const usedPatterns = [];
      let workspaceLayout;

      // some commands should always run in the context of the entire workspace
      const cwd = _this.flags.includeWorkspaceDeps || _this.flags.workspaceRootIsCwd ? _this.config.lockfileFolder : _this.config.cwd;

      // non-workspaces are always root, otherwise check for workspace root
      const cwdIsRoot = !_this.config.workspaceRootFolder || _this.config.lockfileFolder === cwd;

      // exclude package names that are in install args
      const excludeNames = [];
      for (var _iterator = excludePatterns, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        const pattern = _ref;

        if ((0, (_index3 || _load_index3()).getExoticResolver)(pattern)) {
          excludeNames.push((0, (_guessName || _load_guessName()).default)(pattern));
        } else {
          // extract the name
          const parts = (0, (_normalizePattern || _load_normalizePattern()).normalizePattern)(pattern);
          excludeNames.push(parts.name);
        }
      }

      const stripExcluded = function stripExcluded(manifest) {
        for (var _iterator2 = excludeNames, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
          var _ref2;

          if (_isArray2) {
            if (_i2 >= _iterator2.length) break;
            _ref2 = _iterator2[_i2++];
          } else {
            _i2 = _iterator2.next();
            if (_i2.done) break;
            _ref2 = _i2.value;
          }

          const exclude = _ref2;

          if (manifest.dependencies && manifest.dependencies[exclude]) {
            delete manifest.dependencies[exclude];
          }
          if (manifest.devDependencies && manifest.devDependencies[exclude]) {
            delete manifest.devDependencies[exclude];
          }
          if (manifest.optionalDependencies && manifest.optionalDependencies[exclude]) {
            delete manifest.optionalDependencies[exclude];
          }
        }
      };

      for (var _iterator3 = Object.keys((_index2 || _load_index2()).registries), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref3 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref3 = _i3.value;
        }

        const registry = _ref3;

        const filename = (_index2 || _load_index2()).registries[registry].filename;

        const loc = path.join(cwd, filename);
        if (!(yield (_fs || _load_fs()).exists(loc))) {
          continue;
        }

        _this.rootManifestRegistries.push(registry);

        const projectManifestJson = yield _this.config.readJson(loc);
        yield (0, (_index || _load_index()).default)(projectManifestJson, cwd, _this.config, cwdIsRoot);

        Object.assign(_this.resolutions, projectManifestJson.resolutions);
        Object.assign(manifest, projectManifestJson);

        _this.resolutionMap.init(_this.resolutions);
        for (var _iterator4 = Object.keys(_this.resolutionMap.resolutionsByPackage), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
          var _ref4;

          if (_isArray4) {
            if (_i4 >= _iterator4.length) break;
            _ref4 = _iterator4[_i4++];
          } else {
            _i4 = _iterator4.next();
            if (_i4.done) break;
            _ref4 = _i4.value;
          }

          const packageName = _ref4;

          for (var _iterator8 = _this.resolutionMap.resolutionsByPackage[packageName], _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
            var _ref9;

            if (_isArray8) {
              if (_i8 >= _iterator8.length) break;
              _ref9 = _iterator8[_i8++];
            } else {
              _i8 = _iterator8.next();
              if (_i8.done) break;
              _ref9 = _i8.value;
            }

            const _ref8 = _ref9;
            const pattern = _ref8.pattern;

            resolutionDeps = [...resolutionDeps, { registry, pattern, optional: false, hint: 'resolution' }];
          }
        }

        const pushDeps = function pushDeps(depType, manifest, { hint, optional }, isUsed) {
          if (ignoreUnusedPatterns && !isUsed) {
            return;
          }
          // We only take unused dependencies into consideration to get deterministic hoisting.
          // Since flat mode doesn't care about hoisting and everything is top level and specified then we can safely
          // leave these out.
          if (_this.flags.flat && !isUsed) {
            return;
          }
          const depMap = manifest[depType];
          for (const name in depMap) {
            if (excludeNames.indexOf(name) >= 0) {
              continue;
            }

            let pattern = name;
            if (!_this.lockfile.getLocked(pattern)) {
              // when we use --save we save the dependency to the lockfile with just the name rather than the
              // version combo
              pattern += '@' + depMap[name];
            }

            // normalization made sure packages are mentioned only once
            if (isUsed) {
              usedPatterns.push(pattern);
            } else {
              ignorePatterns.push(pattern);
            }

            _this.rootPatternsToOrigin[pattern] = depType;
            patterns.push(pattern);
            deps.push({ pattern, registry, hint, optional, workspaceName: manifest.name, workspaceLoc: manifest._loc });
          }
        };

        if (cwdIsRoot) {
          pushDeps('dependencies', projectManifestJson, { hint: null, optional: false }, true);
          pushDeps('devDependencies', projectManifestJson, { hint: 'dev', optional: false }, !_this.config.production);
          pushDeps('optionalDependencies', projectManifestJson, { hint: 'optional', optional: true }, true);
        }

        if (_this.config.workspaceRootFolder) {
          const workspaceLoc = cwdIsRoot ? loc : path.join(_this.config.lockfileFolder, filename);
          const workspacesRoot = path.dirname(workspaceLoc);

          let workspaceManifestJson = projectManifestJson;
          if (!cwdIsRoot) {
            // the manifest we read before was a child workspace, so get the root
            workspaceManifestJson = yield _this.config.readJson(workspaceLoc);
            yield (0, (_index || _load_index()).default)(workspaceManifestJson, workspacesRoot, _this.config, true);
          }

          const workspaces = yield _this.config.resolveWorkspaces(workspacesRoot, workspaceManifestJson);
          workspaceLayout = new (_workspaceLayout || _load_workspaceLayout()).default(workspaces, _this.config);

          // add virtual manifest that depends on all workspaces, this way package hoisters and resolvers will work fine
          const workspaceDependencies = (0, (_extends2 || _load_extends()).default)({}, workspaceManifestJson.dependencies);
          for (var _iterator5 = Object.keys(workspaces), _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
            var _ref5;

            if (_isArray5) {
              if (_i5 >= _iterator5.length) break;
              _ref5 = _iterator5[_i5++];
            } else {
              _i5 = _iterator5.next();
              if (_i5.done) break;
              _ref5 = _i5.value;
            }

            const workspaceName = _ref5;

            const workspaceManifest = workspaces[workspaceName].manifest;
            workspaceDependencies[workspaceName] = workspaceManifest.version;

            // include dependencies from all workspaces
            if (_this.flags.includeWorkspaceDeps) {
              pushDeps('dependencies', workspaceManifest, { hint: null, optional: false }, true);
              pushDeps('devDependencies', workspaceManifest, { hint: 'dev', optional: false }, !_this.config.production);
              pushDeps('optionalDependencies', workspaceManifest, { hint: 'optional', optional: true }, true);
            }
          }
          const virtualDependencyManifest = {
            _uid: '',
            name: `workspace-aggregator-${uuid.v4()}`,
            version: '1.0.0',
            _registry: 'npm',
            _loc: workspacesRoot,
            dependencies: workspaceDependencies,
            devDependencies: (0, (_extends2 || _load_extends()).default)({}, workspaceManifestJson.devDependencies),
            optionalDependencies: (0, (_extends2 || _load_extends()).default)({}, workspaceManifestJson.optionalDependencies),
            private: workspaceManifestJson.private,
            workspaces: workspaceManifestJson.workspaces
          };
          workspaceLayout.virtualManifestName = virtualDependencyManifest.name;
          const virtualDep = {};
          virtualDep[virtualDependencyManifest.name] = virtualDependencyManifest.version;
          workspaces[virtualDependencyManifest.name] = { loc: workspacesRoot, manifest: virtualDependencyManifest };

          // ensure dependencies that should be excluded are stripped from the correct manifest
          stripExcluded(cwdIsRoot ? virtualDependencyManifest : workspaces[projectManifestJson.name].manifest);

          pushDeps('workspaces', { workspaces: virtualDep }, { hint: 'workspaces', optional: false }, true);

          const implicitWorkspaceDependencies = (0, (_extends2 || _load_extends()).default)({}, workspaceDependencies);

          for (var _iterator6 = (_constants || _load_constants()).OWNED_DEPENDENCY_TYPES, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
            var _ref6;

            if (_isArray6) {
              if (_i6 >= _iterator6.length) break;
              _ref6 = _iterator6[_i6++];
            } else {
              _i6 = _iterator6.next();
              if (_i6.done) break;
              _ref6 = _i6.value;
            }

            const type = _ref6;

            for (var _iterator7 = Object.keys(projectManifestJson[type] || {}), _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
              var _ref7;

              if (_isArray7) {
                if (_i7 >= _iterator7.length) break;
                _ref7 = _iterator7[_i7++];
              } else {
                _i7 = _iterator7.next();
                if (_i7.done) break;
                _ref7 = _i7.value;
              }

              const dependencyName = _ref7;

              delete implicitWorkspaceDependencies[dependencyName];
            }
          }

          pushDeps('dependencies', { dependencies: implicitWorkspaceDependencies }, { hint: 'workspaces', optional: false }, true);
        }

        break;
      }

      // inherit root flat flag
      if (manifest.flat) {
        _this.flags.flat = true;
      }

      return {
        requests: [...resolutionDeps, ...deps],
        patterns,
        manifest,
        usedPatterns,
        ignorePatterns,
        workspaceLayout
      };
    })();
  }

  /**
   * TODO description
   */

  prepareRequests(requests) {
    return requests;
  }

  preparePatterns(patterns) {
    return patterns;
  }
  preparePatternsForLinking(patterns, cwdManifest, cwdIsRoot) {
    return patterns;
  }

  prepareManifests() {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const manifests = yield _this2.config.getRootManifests();
      return manifests;
    })();
  }

  bailout(patterns, workspaceLayout) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // We don't want to skip the audit - it could yield important errors
      if (_this3.flags.audit) {
        return false;
      }
      // PNP is so fast that the integrity check isn't pertinent
      if (_this3.config.plugnplayEnabled) {
        return false;
      }
      if (_this3.flags.skipIntegrityCheck || _this3.flags.force) {
        return false;
      }
      const lockfileCache = _this3.lockfile.cache;
      if (!lockfileCache) {
        return false;
      }
      const lockfileClean = _this3.lockfile.parseResultType === 'success';
      const match = yield _this3.integrityChecker.check(patterns, lockfileCache, _this3.flags, workspaceLayout);
      if (_this3.flags.frozenLockfile && (!lockfileClean || match.missingPatterns.length > 0)) {
        throw new (_errors || _load_errors()).MessageError(_this3.reporter.lang('frozenLockfileError'));
      }

      const haveLockfile = yield (_fs || _load_fs()).exists(path.join(_this3.config.lockfileFolder, (_constants || _load_constants()).LOCKFILE_FILENAME));

      const lockfileIntegrityPresent = !_this3.lockfile.hasEntriesExistWithoutIntegrity();
      const integrityBailout = lockfileIntegrityPresent || !_this3.config.autoAddIntegrity;

      if (match.integrityMatches && haveLockfile && lockfileClean && integrityBailout) {
        _this3.reporter.success(_this3.reporter.lang('upToDate'));
        return true;
      }

      if (match.integrityFileMissing && haveLockfile) {
        // Integrity file missing, force script installations
        _this3.scripts.setForce(true);
        return false;
      }

      if (match.hardRefreshRequired) {
        // e.g. node version doesn't match, force script installations
        _this3.scripts.setForce(true);
        return false;
      }

      if (!patterns.length && !match.integrityFileMissing) {
        _this3.reporter.success(_this3.reporter.lang('nothingToInstall'));
        yield _this3.createEmptyManifestFolders();
        yield _this3.saveLockfileAndIntegrity(patterns, workspaceLayout);
        return true;
      }

      return false;
    })();
  }

  /**
   * Produce empty folders for all used root manifests.
   */

  createEmptyManifestFolders() {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (_this4.config.modulesFolder) {
        // already created
        return;
      }

      for (var _iterator9 = _this4.rootManifestRegistries, _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
        var _ref10;

        if (_isArray9) {
          if (_i9 >= _iterator9.length) break;
          _ref10 = _iterator9[_i9++];
        } else {
          _i9 = _iterator9.next();
          if (_i9.done) break;
          _ref10 = _i9.value;
        }

        const registryName = _ref10;
        const folder = _this4.config.registries[registryName].folder;

        yield (_fs || _load_fs()).mkdirp(path.join(_this4.config.lockfileFolder, folder));
      }
    })();
  }

  /**
   * TODO description
   */

  markIgnored(patterns) {
    for (var _iterator10 = patterns, _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
      var _ref11;

      if (_isArray10) {
        if (_i10 >= _iterator10.length) break;
        _ref11 = _iterator10[_i10++];
      } else {
        _i10 = _iterator10.next();
        if (_i10.done) break;
        _ref11 = _i10.value;
      }

      const pattern = _ref11;

      const manifest = this.resolver.getStrictResolvedPattern(pattern);
      const ref = manifest._reference;
      invariant(ref, 'expected package reference');

      // just mark the package as ignored. if the package is used by a required package, the hoister
      // will take care of that.
      ref.ignore = true;
    }
  }

  /**
   * helper method that gets only recent manifests
   * used by global.ls command
   */
  getFlattenedDeps() {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      var _ref12 = yield _this5.fetchRequestFromCwd();

      const depRequests = _ref12.requests,
            rawPatterns = _ref12.patterns;


      yield _this5.resolver.init(depRequests, {});

      const manifests = yield (_packageFetcher || _load_packageFetcher()).fetch(_this5.resolver.getManifests(), _this5.config);
      _this5.resolver.updateManifests(manifests);

      return _this5.flatten(rawPatterns);
    })();
  }

  /**
   * TODO description
   */

  init() {
    var _this6 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this6.checkUpdate();

      // warn if we have a shrinkwrap
      if (yield (_fs || _load_fs()).exists(path.join(_this6.config.lockfileFolder, (_constants || _load_constants()).NPM_SHRINKWRAP_FILENAME))) {
        _this6.reporter.warn(_this6.reporter.lang('shrinkwrapWarning'));
      }

      // warn if we have an npm lockfile
      if (yield (_fs || _load_fs()).exists(path.join(_this6.config.lockfileFolder, (_constants || _load_constants()).NPM_LOCK_FILENAME))) {
        _this6.reporter.warn(_this6.reporter.lang('npmLockfileWarning'));
      }

      let flattenedTopLevelPatterns = [];
      const steps = [];

      var _ref13 = yield _this6.fetchRequestFromCwd();

      const depRequests = _ref13.requests,
            rawPatterns = _ref13.patterns,
            ignorePatterns = _ref13.ignorePatterns,
            workspaceLayout = _ref13.workspaceLayout,
            manifest = _ref13.manifest;

      let topLevelPatterns = [];

      const artifacts = yield _this6.integrityChecker.getArtifacts();
      if (artifacts) {
        _this6.linker.setArtifacts(artifacts);
        _this6.scripts.setArtifacts(artifacts);
      }

      if ((_packageCompatibility || _load_packageCompatibility()).shouldCheck(manifest, _this6.flags)) {
        steps.push((() => {
          var _ref14 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (curr, total) {
            _this6.reporter.step(curr, total, _this6.reporter.lang('checkingManifest'), emoji.get('mag'));
            yield _this6.checkCompatibility();
          });

          return function (_x, _x2) {
            return _ref14.apply(this, arguments);
          };
        })());
      }

      const audit = new (_audit || _load_audit()).default(_this6.config, _this6.reporter, { groups: (_constants || _load_constants()).OWNED_DEPENDENCY_TYPES });
      let auditFoundProblems = false;

      steps.push(function (curr, total) {
        return (0, (_hooks || _load_hooks()).callThroughHook)('resolveStep', (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
          _this6.reporter.step(curr, total, _this6.reporter.lang('resolvingPackages'), emoji.get('mag'));
          yield _this6.resolver.init(_this6.prepareRequests(depRequests), {
            isFlat: _this6.flags.flat,
            isFrozen: _this6.flags.frozenLockfile,
            workspaceLayout
          });
          topLevelPatterns = _this6.preparePatterns(rawPatterns);
          flattenedTopLevelPatterns = yield _this6.flatten(topLevelPatterns);
          return { bailout: !_this6.flags.audit && (yield _this6.bailout(topLevelPatterns, workspaceLayout)) };
        }));
      });

      if (_this6.flags.audit) {
        steps.push(function (curr, total) {
          return (0, (_hooks || _load_hooks()).callThroughHook)('auditStep', (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
            _this6.reporter.step(curr, total, _this6.reporter.lang('auditRunning'), emoji.get('mag'));
            if (_this6.flags.offline) {
              _this6.reporter.warn(_this6.reporter.lang('auditOffline'));
              return { bailout: false };
            }
            const preparedManifests = yield _this6.prepareManifests();
            // $FlowFixMe - Flow considers `m` in the map operation to be "mixed", so does not recognize `m.object`
            const mergedManifest = Object.assign({}, ...Object.values(preparedManifests).map(function (m) {
              return m.object;
            }));
            const auditVulnerabilityCounts = yield audit.performAudit(mergedManifest, _this6.lockfile, _this6.resolver, _this6.linker, topLevelPatterns);
            auditFoundProblems = auditVulnerabilityCounts.info || auditVulnerabilityCounts.low || auditVulnerabilityCounts.moderate || auditVulnerabilityCounts.high || auditVulnerabilityCounts.critical;
            return { bailout: yield _this6.bailout(topLevelPatterns, workspaceLayout) };
          }));
        });
      }

      steps.push(function (curr, total) {
        return (0, (_hooks || _load_hooks()).callThroughHook)('fetchStep', (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
          _this6.markIgnored(ignorePatterns);
          _this6.reporter.step(curr, total, _this6.reporter.lang('fetchingPackages'), emoji.get('truck'));
          const manifests = yield (_packageFetcher || _load_packageFetcher()).fetch(_this6.resolver.getManifests(), _this6.config);
          _this6.resolver.updateManifests(manifests);
          yield (_packageCompatibility || _load_packageCompatibility()).check(_this6.resolver.getManifests(), _this6.config, _this6.flags.ignoreEngines);
        }));
      });

      steps.push(function (curr, total) {
        return (0, (_hooks || _load_hooks()).callThroughHook)('linkStep', (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
          // remove integrity hash to make this operation atomic
          yield _this6.integrityChecker.removeIntegrityFile();
          _this6.reporter.step(curr, total, _this6.reporter.lang('linkingDependencies'), emoji.get('link'));
          flattenedTopLevelPatterns = _this6.preparePatternsForLinking(flattenedTopLevelPatterns, manifest, _this6.config.lockfileFolder === _this6.config.cwd);
          yield _this6.linker.init(flattenedTopLevelPatterns, workspaceLayout, {
            linkDuplicates: _this6.flags.linkDuplicates,
            ignoreOptional: _this6.flags.ignoreOptional
          });
        }));
      });

      if (_this6.config.plugnplayEnabled) {
        steps.push(function (curr, total) {
          return (0, (_hooks || _load_hooks()).callThroughHook)('pnpStep', (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
            const pnpPath = `${_this6.config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`;

            const code = yield (0, (_generatePnpMap || _load_generatePnpMap()).generatePnpMap)(_this6.config, flattenedTopLevelPatterns, {
              resolver: _this6.resolver,
              reporter: _this6.reporter,
              targetPath: pnpPath,
              workspaceLayout
            });

            try {
              const file = yield (_fs || _load_fs()).readFile(pnpPath);
              if (file === code) {
                return;
              }
            } catch (error) {}

            yield (_fs || _load_fs()).writeFile(pnpPath, code);
            yield (_fs || _load_fs()).chmod(pnpPath, 0o755);
          }));
        });
      }

      steps.push(function (curr, total) {
        return (0, (_hooks || _load_hooks()).callThroughHook)('buildStep', (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
          _this6.reporter.step(curr, total, _this6.flags.force ? _this6.reporter.lang('rebuildingPackages') : _this6.reporter.lang('buildingFreshPackages'), emoji.get('hammer'));

          if (_this6.config.ignoreScripts) {
            _this6.reporter.warn(_this6.reporter.lang('ignoredScripts'));
          } else {
            yield _this6.scripts.init(flattenedTopLevelPatterns);
          }
        }));
      });

      if (_this6.flags.har) {
        steps.push((() => {
          var _ref21 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (curr, total) {
            const formattedDate = new Date().toISOString().replace(/:/g, '-');
            const filename = `yarn-install_${formattedDate}.har`;
            _this6.reporter.step(curr, total, _this6.reporter.lang('savingHar', filename), emoji.get('black_circle_for_record'));
            yield _this6.config.requestManager.saveHar(filename);
          });

          return function (_x3, _x4) {
            return _ref21.apply(this, arguments);
          };
        })());
      }

      if (yield _this6.shouldClean()) {
        steps.push((() => {
          var _ref22 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (curr, total) {
            _this6.reporter.step(curr, total, _this6.reporter.lang('cleaningModules'), emoji.get('recycle'));
            yield (0, (_autoclean || _load_autoclean()).clean)(_this6.config, _this6.reporter);
          });

          return function (_x5, _x6) {
            return _ref22.apply(this, arguments);
          };
        })());
      }

      let currentStep = 0;
      for (var _iterator11 = steps, _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
        var _ref23;

        if (_isArray11) {
          if (_i11 >= _iterator11.length) break;
          _ref23 = _iterator11[_i11++];
        } else {
          _i11 = _iterator11.next();
          if (_i11.done) break;
          _ref23 = _i11.value;
        }

        const step = _ref23;

        const stepResult = yield step(++currentStep, steps.length);
        if (stepResult && stepResult.bailout) {
          if (_this6.flags.audit) {
            audit.summary();
          }
          if (auditFoundProblems) {
            _this6.reporter.warn(_this6.reporter.lang('auditRunAuditForDetails'));
          }
          _this6.maybeOutputUpdate();
          return flattenedTopLevelPatterns;
        }
      }

      // fin!
      if (_this6.flags.audit) {
        audit.summary();
      }
      if (auditFoundProblems) {
        _this6.reporter.warn(_this6.reporter.lang('auditRunAuditForDetails'));
      }
      yield _this6.saveLockfileAndIntegrity(topLevelPatterns, workspaceLayout);
      yield _this6.persistChanges();
      _this6.maybeOutputUpdate();
      _this6.config.requestManager.clearCache();
      return flattenedTopLevelPatterns;
    })();
  }

  checkCompatibility() {
    var _this7 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      var _ref24 = yield _this7.fetchRequestFromCwd();

      const manifest = _ref24.manifest;

      yield (_packageCompatibility || _load_packageCompatibility()).checkOne(manifest, _this7.config, _this7.flags.ignoreEngines);
    })();
  }

  persistChanges() {
    var _this8 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // get all the different registry manifests in this folder
      const manifests = yield _this8.config.getRootManifests();

      if (yield _this8.applyChanges(manifests)) {
        yield _this8.config.saveRootManifests(manifests);
      }
    })();
  }

  applyChanges(manifests) {
    let hasChanged = false;

    if (this.config.plugnplayPersist) {
      const object = manifests.npm.object;


      if (typeof object.installConfig !== 'object') {
        object.installConfig = {};
      }

      if (this.config.plugnplayEnabled && object.installConfig.pnp !== true) {
        object.installConfig.pnp = true;
        hasChanged = true;
      } else if (!this.config.plugnplayEnabled && typeof object.installConfig.pnp !== 'undefined') {
        delete object.installConfig.pnp;
        hasChanged = true;
      }

      if (Object.keys(object.installConfig).length === 0) {
        delete object.installConfig;
      }
    }

    return Promise.resolve(hasChanged);
  }

  /**
   * Check if we should run the cleaning step.
   */

  shouldClean() {
    return (_fs || _load_fs()).exists(path.join(this.config.lockfileFolder, (_constants || _load_constants()).CLEAN_FILENAME));
  }

  /**
   * TODO
   */

  flatten(patterns) {
    var _this9 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (!_this9.flags.flat) {
        return patterns;
      }

      const flattenedPatterns = [];

      for (var _iterator12 = _this9.resolver.getAllDependencyNamesByLevelOrder(patterns), _isArray12 = Array.isArray(_iterator12), _i12 = 0, _iterator12 = _isArray12 ? _iterator12 : _iterator12[Symbol.iterator]();;) {
        var _ref25;

        if (_isArray12) {
          if (_i12 >= _iterator12.length) break;
          _ref25 = _iterator12[_i12++];
        } else {
          _i12 = _iterator12.next();
          if (_i12.done) break;
          _ref25 = _i12.value;
        }

        const name = _ref25;

        const infos = _this9.resolver.getAllInfoForPackageName(name).filter(function (manifest) {
          const ref = manifest._reference;
          invariant(ref, 'expected package reference');
          return !ref.ignore;
        });

        if (infos.length === 0) {
          continue;
        }

        if (infos.length === 1) {
          // single version of this package
          // take out a single pattern as multiple patterns may have resolved to this package
          flattenedPatterns.push(_this9.resolver.patternsByPackage[name][0]);
          continue;
        }

        const options = infos.map(function (info) {
          const ref = info._reference;
          invariant(ref, 'expected reference');
          return {
            // TODO `and is required by {PARENT}`,
            name: _this9.reporter.lang('manualVersionResolutionOption', ref.patterns.join(', '), info.version),

            value: info.version
          };
        });
        const versions = infos.map(function (info) {
          return info.version;
        });
        let version;

        const resolutionVersion = _this9.resolutions[name];
        if (resolutionVersion && versions.indexOf(resolutionVersion) >= 0) {
          // use json `resolution` version
          version = resolutionVersion;
        } else {
          version = yield _this9.reporter.select(_this9.reporter.lang('manualVersionResolution', name), _this9.reporter.lang('answer'), options);
          _this9.resolutions[name] = version;
        }

        flattenedPatterns.push(_this9.resolver.collapseAllVersionsOfPackage(name, version));
      }

      // save resolutions to their appropriate root manifest
      if (Object.keys(_this9.resolutions).length) {
        const manifests = yield _this9.config.getRootManifests();

        for (const name in _this9.resolutions) {
          const version = _this9.resolutions[name];

          const patterns = _this9.resolver.patternsByPackage[name];
          if (!patterns) {
            continue;
          }

          let manifest;
          for (var _iterator13 = patterns, _isArray13 = Array.isArray(_iterator13), _i13 = 0, _iterator13 = _isArray13 ? _iterator13 : _iterator13[Symbol.iterator]();;) {
            var _ref26;

            if (_isArray13) {
              if (_i13 >= _iterator13.length) break;
              _ref26 = _iterator13[_i13++];
            } else {
              _i13 = _iterator13.next();
              if (_i13.done) break;
              _ref26 = _i13.value;
            }

            const pattern = _ref26;

            manifest = _this9.resolver.getResolvedPattern(pattern);
            if (manifest) {
              break;
            }
          }
          invariant(manifest, 'expected manifest');

          const ref = manifest._reference;
          invariant(ref, 'expected reference');

          const object = manifests[ref.registry].object;
          object.resolutions = object.resolutions || {};
          object.resolutions[name] = version;
        }

        yield _this9.config.saveRootManifests(manifests);
      }

      return flattenedPatterns;
    })();
  }

  /**
   * Remove offline tarballs that are no longer required
   */

  pruneOfflineMirror(lockfile) {
    var _this10 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const mirror = _this10.config.getOfflineMirrorPath();
      if (!mirror) {
        return;
      }

      const requiredTarballs = new Set();
      for (const dependency in lockfile) {
        const resolved = lockfile[dependency].resolved;
        if (resolved) {
          const basename = path.basename(resolved.split('#')[0]);
          if (dependency[0] === '@' && basename[0] !== '@') {
            requiredTarballs.add(`${dependency.split('/')[0]}-${basename}`);
          }
          requiredTarballs.add(basename);
        }
      }

      const mirrorFiles = yield (_fs || _load_fs()).walk(mirror);
      for (var _iterator14 = mirrorFiles, _isArray14 = Array.isArray(_iterator14), _i14 = 0, _iterator14 = _isArray14 ? _iterator14 : _iterator14[Symbol.iterator]();;) {
        var _ref27;

        if (_isArray14) {
          if (_i14 >= _iterator14.length) break;
          _ref27 = _iterator14[_i14++];
        } else {
          _i14 = _iterator14.next();
          if (_i14.done) break;
          _ref27 = _i14.value;
        }

        const file = _ref27;

        const isTarball = path.extname(file.basename) === '.tgz';
        // if using experimental-pack-script-packages-in-mirror flag, don't unlink prebuilt packages
        const hasPrebuiltPackage = file.relative.startsWith('prebuilt/');
        if (isTarball && !hasPrebuiltPackage && !requiredTarballs.has(file.basename)) {
          yield (_fs || _load_fs()).unlink(file.absolute);
        }
      }
    })();
  }

  /**
   * Save updated integrity and lockfiles.
   */

  saveLockfileAndIntegrity(patterns, workspaceLayout) {
    var _this11 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const resolvedPatterns = {};
      Object.keys(_this11.resolver.patterns).forEach(function (pattern) {
        if (!workspaceLayout || !workspaceLayout.getManifestByPattern(pattern)) {
          resolvedPatterns[pattern] = _this11.resolver.patterns[pattern];
        }
      });

      // TODO this code is duplicated in a few places, need a common way to filter out workspace patterns from lockfile
      patterns = patterns.filter(function (p) {
        return !workspaceLayout || !workspaceLayout.getManifestByPattern(p);
      });

      const lockfileBasedOnResolver = _this11.lockfile.getLockfile(resolvedPatterns);

      if (_this11.config.pruneOfflineMirror) {
        yield _this11.pruneOfflineMirror(lockfileBasedOnResolver);
      }

      // write integrity hash
      if (!_this11.config.plugnplayEnabled) {
        yield _this11.integrityChecker.save(patterns, lockfileBasedOnResolver, _this11.flags, workspaceLayout, _this11.scripts.getArtifacts());
      }

      // --no-lockfile or --pure-lockfile or --frozen-lockfile
      if (_this11.flags.lockfile === false || _this11.flags.pureLockfile || _this11.flags.frozenLockfile) {
        return;
      }

      const lockFileHasAllPatterns = patterns.every(function (p) {
        return _this11.lockfile.getLocked(p);
      });
      const lockfilePatternsMatch = Object.keys(_this11.lockfile.cache || {}).every(function (p) {
        return lockfileBasedOnResolver[p];
      });
      const resolverPatternsAreSameAsInLockfile = Object.keys(lockfileBasedOnResolver).every(function (pattern) {
        const manifest = _this11.lockfile.getLocked(pattern);
        return manifest && manifest.resolved === lockfileBasedOnResolver[pattern].resolved && deepEqual(manifest.prebuiltVariants, lockfileBasedOnResolver[pattern].prebuiltVariants);
      });
      const integrityPatternsAreSameAsInLockfile = Object.keys(lockfileBasedOnResolver).every(function (pattern) {
        const existingIntegrityInfo = lockfileBasedOnResolver[pattern].integrity;
        if (!existingIntegrityInfo) {
          // if this entry does not have an integrity, no need to re-write the lockfile because of it
          return true;
        }
        const manifest = _this11.lockfile.getLocked(pattern);
        if (manifest && manifest.integrity) {
          const manifestIntegrity = ssri.stringify(manifest.integrity);
          return manifestIntegrity === existingIntegrityInfo;
        }
        return false;
      });

      // remove command is followed by install with force, lockfile will be rewritten in any case then
      if (!_this11.flags.force && _this11.lockfile.parseResultType === 'success' && lockFileHasAllPatterns && lockfilePatternsMatch && resolverPatternsAreSameAsInLockfile && integrityPatternsAreSameAsInLockfile && patterns.length) {
        return;
      }

      // build lockfile location
      const loc = path.join(_this11.config.lockfileFolder, (_constants || _load_constants()).LOCKFILE_FILENAME);

      // write lockfile
      const lockSource = (0, (_lockfile2 || _load_lockfile2()).stringify)(lockfileBasedOnResolver, false, _this11.config.enableLockfileVersions);
      yield (_fs || _load_fs()).writeFilePreservingEol(loc, lockSource);

      _this11._logSuccessSaveLockfile();
    })();
  }

  _logSuccessSaveLockfile() {
    this.reporter.success(this.reporter.lang('savedLockfile'));
  }

  /**
   * Load the dependency graph of the current install. Only does package resolving and wont write to the cwd.
   */
  hydrate(ignoreUnusedPatterns) {
    var _this12 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const request = yield _this12.fetchRequestFromCwd([], ignoreUnusedPatterns);
      const depRequests = request.requests,
            rawPatterns = request.patterns,
            ignorePatterns = request.ignorePatterns,
            workspaceLayout = request.workspaceLayout;


      yield _this12.resolver.init(depRequests, {
        isFlat: _this12.flags.flat,
        isFrozen: _this12.flags.frozenLockfile,
        workspaceLayout
      });
      yield _this12.flatten(rawPatterns);
      _this12.markIgnored(ignorePatterns);

      // fetch packages, should hit cache most of the time
      const manifests = yield (_packageFetcher || _load_packageFetcher()).fetch(_this12.resolver.getManifests(), _this12.config);
      _this12.resolver.updateManifests(manifests);
      yield (_packageCompatibility || _load_packageCompatibility()).check(_this12.resolver.getManifests(), _this12.config, _this12.flags.ignoreEngines);

      // expand minimal manifests
      for (var _iterator15 = _this12.resolver.getManifests(), _isArray15 = Array.isArray(_iterator15), _i15 = 0, _iterator15 = _isArray15 ? _iterator15 : _iterator15[Symbol.iterator]();;) {
        var _ref28;

        if (_isArray15) {
          if (_i15 >= _iterator15.length) break;
          _ref28 = _iterator15[_i15++];
        } else {
          _i15 = _iterator15.next();
          if (_i15.done) break;
          _ref28 = _i15.value;
        }

        const manifest = _ref28;

        const ref = manifest._reference;
        invariant(ref, 'expected reference');
        const type = ref.remote.type;
        // link specifier won't ever hit cache

        let loc = '';
        if (type === 'link') {
          continue;
        } else if (type === 'workspace') {
          if (!ref.remote.reference) {
            continue;
          }
          loc = ref.remote.reference;
        } else {
          loc = _this12.config.generateModuleCachePath(ref);
        }
        const newPkg = yield _this12.config.readManifest(loc);
        yield _this12.resolver.updateManifest(ref, newPkg);
      }

      return request;
    })();
  }

  /**
   * Check for updates every day and output a nag message if there's a newer version.
   */

  checkUpdate() {
    if (this.config.nonInteractive) {
      // don't show upgrade dialog on CI or non-TTY terminals
      return;
    }

    // don't check if disabled
    if (this.config.getOption('disable-self-update-check')) {
      return;
    }

    // only check for updates once a day
    const lastUpdateCheck = Number(this.config.getOption('lastUpdateCheck')) || 0;
    if (lastUpdateCheck && Date.now() - lastUpdateCheck < ONE_DAY) {
      return;
    }

    // don't bug for updates on tagged releases
    if ((_yarnVersion || _load_yarnVersion()).version.indexOf('-') >= 0) {
      return;
    }

    this._checkUpdate().catch(() => {
      // swallow errors
    });
  }

  _checkUpdate() {
    var _this13 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let latestVersion = yield _this13.config.requestManager.request({
        url: (_constants || _load_constants()).SELF_UPDATE_VERSION_URL
      });
      invariant(typeof latestVersion === 'string', 'expected string');
      latestVersion = latestVersion.trim();
      if (!semver.valid(latestVersion)) {
        return;
      }

      // ensure we only check for updates periodically
      _this13.config.registries.yarn.saveHomeConfig({
        lastUpdateCheck: Date.now()
      });

      if (semver.gt(latestVersion, (_yarnVersion || _load_yarnVersion()).version)) {
        const installationMethod = yield (0, (_yarnVersion || _load_yarnVersion()).getInstallationMethod)();
        _this13.maybeOutputUpdate = function () {
          _this13.reporter.warn(_this13.reporter.lang('yarnOutdated', latestVersion, (_yarnVersion || _load_yarnVersion()).version));

          const command = getUpdateCommand(installationMethod);
          if (command) {
            _this13.reporter.info(_this13.reporter.lang('yarnOutdatedCommand'));
            _this13.reporter.command(command);
          } else {
            const installer = getUpdateInstaller(installationMethod);
            if (installer) {
              _this13.reporter.info(_this13.reporter.lang('yarnOutdatedInstaller', installer));
            }
          }
        };
      }
    })();
  }

  /**
   * Method to override with a possible upgrade message.
   */

  maybeOutputUpdate() {}
}

exports.Install = Install;
function hasWrapper(commander, args) {
  return true;
}

function setFlags(commander) {
  commander.description('Yarn install is used to install all dependencies for a project.');
  commander.usage('install [flags]');
  commander.option('-A, --audit', 'Run vulnerability audit on installed packages');
  commander.option('-g, --global', 'DEPRECATED');
  commander.option('-S, --save', 'DEPRECATED - save package to your `dependencies`');
  commander.option('-D, --save-dev', 'DEPRECATED - save package to your `devDependencies`');
  commander.option('-P, --save-peer', 'DEPRECATED - save package to your `peerDependencies`');
  commander.option('-O, --save-optional', 'DEPRECATED - save package to your `optionalDependencies`');
  commander.option('-E, --save-exact', 'DEPRECATED');
  commander.option('-T, --save-tilde', 'DEPRECATED');
}