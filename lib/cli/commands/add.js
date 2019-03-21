'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.Add = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

let run = exports.run = (() => {
  var _ref7 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (!args.length) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('missingAddDependencies'));
    }

    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder, reporter);

    yield (0, (_install || _load_install()).wrapLifecycle)(config, flags, (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const install = new Add(args, flags, config, reporter, lockfile);
      yield install.init();
    }));
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref7.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _normalizePattern2;

function _load_normalizePattern() {
  return _normalizePattern2 = require('../../util/normalize-pattern.js');
}

var _workspaceLayout;

function _load_workspaceLayout() {
  return _workspaceLayout = _interopRequireDefault(require('../../workspace-layout.js'));
}

var _index;

function _load_index() {
  return _index = require('../../resolvers/index.js');
}

var _list;

function _load_list() {
  return _list = require('./list.js');
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../../constants.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _invariant;

function _load_invariant() {
  return _invariant = _interopRequireDefault(require('invariant'));
}

var _path;

function _load_path() {
  return _path = _interopRequireDefault(require('path'));
}

var _semver;

function _load_semver() {
  return _semver = _interopRequireDefault(require('semver'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const SILENCE_DEPENDENCY_TYPE_WARNINGS = ['upgrade', 'upgrade-interactive'];

class Add extends (_install || _load_install()).Install {
  constructor(args, flags, config, reporter, lockfile) {
    const workspaceRootIsCwd = config.cwd === config.lockfileFolder;
    const _flags = flags ? (0, (_extends2 || _load_extends()).default)({}, flags, { workspaceRootIsCwd }) : { workspaceRootIsCwd };
    super(_flags, config, reporter, lockfile);
    this.args = args;
    // only one flag is supported, so we can figure out which one was passed to `yarn add`
    this.flagToOrigin = [flags.dev && 'devDependencies', flags.optional && 'optionalDependencies', flags.peer && 'peerDependencies', 'dependencies'].filter(Boolean).shift();
  }

  /**
   * TODO
   */

  prepareRequests(requests) {
    const requestsWithArgs = requests.slice();

    for (var _iterator = this.args, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
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

      requestsWithArgs.push({
        pattern,
        registry: 'npm',
        optional: false
      });
    }
    return requestsWithArgs;
  }

  /**
   * returns version for a pattern based on Manifest
   */
  getPatternVersion(pattern, pkg) {
    const tilde = this.flags.tilde;
    const configPrefix = String(this.config.getOption('save-prefix'));
    const exact = this.flags.exact || Boolean(this.config.getOption('save-exact')) || configPrefix === '';

    var _normalizePattern = (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(pattern);

    const hasVersion = _normalizePattern.hasVersion,
          range = _normalizePattern.range;

    let version;

    if ((0, (_index || _load_index()).getExoticResolver)(pattern)) {
      // wasn't a name/range tuple so this is just a raw exotic pattern
      version = pattern;
    } else if (hasVersion && range && ((_semver || _load_semver()).default.satisfies(pkg.version, range) || (0, (_index || _load_index()).getExoticResolver)(range))) {
      // if the user specified a range then use it verbatim
      version = range;
    }

    if (!version || (_semver || _load_semver()).default.valid(version)) {
      let prefix = configPrefix || '^';

      if (tilde) {
        prefix = '~';
      } else if (version || exact) {
        prefix = '';
      }
      version = `${prefix}${pkg.version}`;
    }

    return version;
  }

  preparePatterns(patterns) {
    const preparedPatterns = patterns.slice();
    for (var _iterator2 = this.resolver.dedupePatterns(this.args), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref2 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref2 = _i2.value;
      }

      const pattern = _ref2;

      const pkg = this.resolver.getResolvedPattern(pattern);
      (0, (_invariant || _load_invariant()).default)(pkg, `missing package ${pattern}`);
      const version = this.getPatternVersion(pattern, pkg);
      const newPattern = `${pkg.name}@${version}`;
      preparedPatterns.push(newPattern);
      this.addedPatterns.push(newPattern);
      if (newPattern === pattern) {
        continue;
      }
      this.resolver.replacePattern(pattern, newPattern);
    }
    return preparedPatterns;
  }

  preparePatternsForLinking(patterns, cwdManifest, cwdIsRoot) {
    // remove the newly added patterns if cwd != root and update the in-memory package dependency instead
    if (cwdIsRoot) {
      return patterns;
    }

    let manifest;
    const cwdPackage = `${cwdManifest.name}@${cwdManifest.version}`;
    try {
      manifest = this.resolver.getStrictResolvedPattern(cwdPackage);
    } catch (e) {
      this.reporter.warn(this.reporter.lang('unknownPackage', cwdPackage));
      return patterns;
    }

    let newPatterns = patterns;
    this._iterateAddedPackages((pattern, registry, dependencyType, pkgName, version) => {
      // remove added package from patterns list
      const filtered = newPatterns.filter(p => p !== pattern);
      (0, (_invariant || _load_invariant()).default)(newPatterns.length - filtered.length > 0, `expect added pattern '${pattern}' in the list: ${patterns.toString()}`);
      newPatterns = filtered;

      // add new package into in-memory manifest so they can be linked properly
      manifest[dependencyType] = manifest[dependencyType] || {};
      if (manifest[dependencyType][pkgName] === version) {
        // package already existed
        return;
      }

      // update dependencies in the manifest
      (0, (_invariant || _load_invariant()).default)(manifest._reference, 'manifest._reference should not be null');
      const ref = manifest._reference;

      ref['dependencies'] = ref['dependencies'] || [];
      ref['dependencies'].push(pattern);
    });

    return newPatterns;
  }

  bailout(patterns, workspaceLayout) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const lockfileCache = _this.lockfile.cache;
      if (!lockfileCache) {
        return false;
      }
      const match = yield _this.integrityChecker.check(patterns, lockfileCache, _this.flags, workspaceLayout);
      const haveLockfile = yield (_fs || _load_fs()).exists((_path || _load_path()).default.join(_this.config.lockfileFolder, (_constants || _load_constants()).LOCKFILE_FILENAME));
      if (match.integrityFileMissing && haveLockfile) {
        // Integrity file missing, force script installations
        _this.scripts.setForce(true);
      }
      return false;
    })();
  }

  /**
   * Description
   */

  init() {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const isWorkspaceRoot = _this2.config.workspaceRootFolder && _this2.config.cwd === _this2.config.workspaceRootFolder;

      // running "yarn add something" in a workspace root is often a mistake
      if (isWorkspaceRoot && !_this2.flags.ignoreWorkspaceRootCheck) {
        throw new (_errors || _load_errors()).MessageError(_this2.reporter.lang('workspacesAddRootCheck'));
      }

      _this2.addedPatterns = [];
      const patterns = yield (_install || _load_install()).Install.prototype.init.call(_this2);
      yield _this2.maybeOutputSaveTree(patterns);
      return patterns;
    })();
  }

  applyChanges(manifests) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield (_install || _load_install()).Install.prototype.applyChanges.call(_this3, manifests);

      // fill rootPatternsToOrigin without `excludePatterns`
      yield (_install || _load_install()).Install.prototype.fetchRequestFromCwd.call(_this3);

      _this3._iterateAddedPackages(function (pattern, registry, dependencyType, pkgName, version) {
        // add it to manifest
        const object = manifests[registry].object;


        object[dependencyType] = object[dependencyType] || {};
        object[dependencyType][pkgName] = version;
        if (SILENCE_DEPENDENCY_TYPE_WARNINGS.indexOf(_this3.config.commandName) === -1 && dependencyType !== _this3.flagToOrigin) {
          _this3.reporter.warn(_this3.reporter.lang('moduleAlreadyInManifest', pkgName, dependencyType, _this3.flagToOrigin));
        }
      });

      return true;
    })();
  }

  /**
   * Description
   */

  fetchRequestFromCwd() {
    return (_install || _load_install()).Install.prototype.fetchRequestFromCwd.call(this, this.args);
  }

  /**
   * Output a tree of any newly added dependencies.
   */

  maybeOutputSaveTree(patterns) {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // don't limit the shown tree depth
      const opts = {
        reqDepth: 0
      };

      // restore the original patterns
      const merged = [...patterns, ..._this4.addedPatterns];

      var _ref3 = yield (0, (_list || _load_list()).buildTree)(_this4.resolver, _this4.linker, merged, opts, true, true);

      const trees = _ref3.trees,
            count = _ref3.count;


      if (count === 1) {
        _this4.reporter.success(_this4.reporter.lang('savedNewDependency'));
      } else {
        _this4.reporter.success(_this4.reporter.lang('savedNewDependencies', count));
      }

      if (!count) {
        return;
      }

      const resolverPatterns = new Set();
      for (var _iterator3 = patterns, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref4 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref4 = _i3.value;
        }

        const pattern = _ref4;

        var _ref5 = _this4.resolver.getResolvedPattern(pattern) || {};

        const version = _ref5.version,
              name = _ref5.name;

        resolverPatterns.add(`${name}@${version}`);
      }
      const directRequireDependencies = trees.filter(function ({ name }) {
        return resolverPatterns.has(name);
      });

      _this4.reporter.info(_this4.reporter.lang('directDependencies'));
      _this4.reporter.tree('newDirectDependencies', directRequireDependencies);
      _this4.reporter.info(_this4.reporter.lang('allDependencies'));
      _this4.reporter.tree('newAllDependencies', trees);
    })();
  }

  /**
   * Save added packages to manifest if any of the --save flags were used.
   */

  savePackages() {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {})();
  }

  _iterateAddedPackages(f) {
    const patternOrigins = Object.keys(this.rootPatternsToOrigin);

    // add new patterns to their appropriate registry manifest
    for (var _iterator4 = this.addedPatterns, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref6;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref6 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref6 = _i4.value;
      }

      const pattern = _ref6;

      const pkg = this.resolver.getResolvedPattern(pattern);
      (0, (_invariant || _load_invariant()).default)(pkg, `missing package ${pattern}`);
      const version = this.getPatternVersion(pattern, pkg);
      const ref = pkg._reference;
      (0, (_invariant || _load_invariant()).default)(ref, 'expected package reference');
      // lookup the package to determine dependency type; used during `yarn upgrade`
      const depType = patternOrigins.reduce((acc, prev) => {
        if (prev.indexOf(`${pkg.name}@`) === 0) {
          return this.rootPatternsToOrigin[prev];
        }
        return acc;
      }, null);

      // depType is calculated when `yarn upgrade` command is used
      const target = depType || this.flagToOrigin;

      f(pattern, ref.registry, target, pkg.name, version);
    }
  }
}

exports.Add = Add;
function hasWrapper(commander) {
  return true;
}

function setFlags(commander) {
  commander.description('Installs a package and any packages that it depends on.');
  commander.usage('add [packages ...] [flags]');
  commander.option('-W, --ignore-workspace-root-check', 'required to run yarn add inside a workspace root');
  commander.option('-D, --dev', 'save package to your `devDependencies`');
  commander.option('-P, --peer', 'save package to your `peerDependencies`');
  commander.option('-O, --optional', 'save package to your `optionalDependencies`');
  commander.option('-E, --exact', 'install exact version');
  commander.option('-T, --tilde', 'install most recent release with the same minor version');
  commander.option('-A', '--audit', 'Run vulnerability audit on installed packages');
}