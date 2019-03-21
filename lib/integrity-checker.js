'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.integrityErrors = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('./constants.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./util/fs.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('./util/misc.js');
}

var _packageNameUtils;

function _load_packageNameUtils() {
  return _packageNameUtils = require('./util/package-name-utils.js');
}

var _workspaceLayout;

function _load_workspaceLayout() {
  return _workspaceLayout = _interopRequireDefault(require('./workspace-layout.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const path = require('path');

const integrityErrors = exports.integrityErrors = {
  EXPECTED_IS_NOT_A_JSON: 'integrityFailedExpectedIsNotAJSON',
  FILES_MISSING: 'integrityFailedFilesMissing',
  LOCKFILE_DONT_MATCH: 'integrityLockfilesDontMatch',
  FLAGS_DONT_MATCH: 'integrityFlagsDontMatch',
  LINKED_MODULES_DONT_MATCH: 'integrityCheckLinkedModulesDontMatch',
  PATTERNS_DONT_MATCH: 'integrityPatternsDontMatch',
  MODULES_FOLDERS_MISSING: 'integrityModulesFoldersMissing',
  SYSTEM_PARAMS_DONT_MATCH: 'integritySystemParamsDontMatch'
};

const INTEGRITY_FILE_DEFAULTS = () => ({
  systemParams: (0, (_packageNameUtils || _load_packageNameUtils()).getSystemParams)(),
  modulesFolders: [],
  flags: [],
  linkedModules: [],
  topLevelPatterns: [],
  lockfileEntries: {},
  files: []
});

/**
 *
 */
class InstallationIntegrityChecker {
  constructor(config) {
    this.config = config;
  }

  /**
   * Get the common ancestor of every node_modules - it may be a node_modules directory itself, but isn't required to.
   */

  _getModulesRootFolder() {
    if (this.config.modulesFolder) {
      return this.config.modulesFolder;
    } else if (this.config.workspaceRootFolder) {
      return this.config.workspaceRootFolder;
    } else {
      return path.join(this.config.lockfileFolder, (_constants || _load_constants()).NODE_MODULES_FOLDER);
    }
  }

  /**
   * Get the directory in which the yarn-integrity file should be written.
   */

  _getIntegrityFileFolder() {
    if (this.config.modulesFolder) {
      return this.config.modulesFolder;
    } else if (this.config.enableMetaFolder) {
      return path.join(this.config.lockfileFolder, (_constants || _load_constants()).META_FOLDER);
    } else {
      return path.join(this.config.lockfileFolder, (_constants || _load_constants()).NODE_MODULES_FOLDER);
    }
  }

  /**
   * Get the full path of the yarn-integrity file.
   */

  _getIntegrityFileLocation() {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const locationFolder = _this._getIntegrityFileFolder();
      const locationPath = path.join(locationFolder, (_constants || _load_constants()).INTEGRITY_FILENAME);

      const exists = yield (_fs || _load_fs()).exists(locationPath);

      return {
        locationFolder,
        locationPath,
        exists
      };
    })();
  }

  /**
   * Get the list of the directories that contain our modules (there might be multiple such folders b/c of workspaces).
   */

  _getModulesFolders({ workspaceLayout } = {}) {
    const locations = [];

    if (this.config.modulesFolder) {
      locations.push(this.config.modulesFolder);
    } else {
      locations.push(path.join(this.config.lockfileFolder, (_constants || _load_constants()).NODE_MODULES_FOLDER));
    }

    if (workspaceLayout) {
      for (var _iterator = Object.keys(workspaceLayout.workspaces), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        const workspaceName = _ref;

        const loc = workspaceLayout.workspaces[workspaceName].loc;

        if (loc) {
          locations.push(path.join(loc, (_constants || _load_constants()).NODE_MODULES_FOLDER));
        }
      }
    }

    return locations.sort((_misc || _load_misc()).sortAlpha);
  }

  /**
   * Get a list of the files that are located inside our module folders.
   */
  _getIntegrityListing({ workspaceLayout } = {}) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const files = [];

      const recurse = (() => {
        var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (dir) {
          for (var _iterator2 = yield (_fs || _load_fs()).readdir(dir), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
            var _ref3;

            if (_isArray2) {
              if (_i2 >= _iterator2.length) break;
              _ref3 = _iterator2[_i2++];
            } else {
              _i2 = _iterator2.next();
              if (_i2.done) break;
              _ref3 = _i2.value;
            }

            const file = _ref3;

            const entry = path.join(dir, file);
            const stat = yield (_fs || _load_fs()).lstat(entry);

            if (stat.isDirectory()) {
              yield recurse(entry);
            } else {
              files.push(entry);
            }
          }
        });

        return function recurse(_x) {
          return _ref2.apply(this, arguments);
        };
      })();

      for (var _iterator3 = _this2._getModulesFolders({ workspaceLayout }), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref4 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref4 = _i3.value;
        }

        const modulesFolder = _ref4;

        if (yield (_fs || _load_fs()).exists(modulesFolder)) {
          yield recurse(modulesFolder);
        }
      }

      return files;
    })();
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  _generateIntegrityFile(lockfile, patterns, flags, workspaceLayout, artifacts) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const result = (0, (_extends2 || _load_extends()).default)({}, INTEGRITY_FILE_DEFAULTS(), {
        artifacts
      });

      result.topLevelPatterns = patterns;

      // If using workspaces, we also need to add the workspaces patterns to the top-level, so that we'll know if a
      // dependency is added or removed into one of them. We must take care not to read the aggregator (if !loc).
      //
      // Also note that we can't use of workspaceLayout.workspaces[].manifest._reference.patterns, because when
      // doing a "yarn check", the _reference property hasn't yet been properly initialized.

      if (workspaceLayout) {
        result.topLevelPatterns = result.topLevelPatterns.filter(function (p) {
          // $FlowFixMe
          return !workspaceLayout.getManifestByPattern(p);
        });

        for (var _iterator4 = Object.keys(workspaceLayout.workspaces), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
          var _ref5;

          if (_isArray4) {
            if (_i4 >= _iterator4.length) break;
            _ref5 = _iterator4[_i4++];
          } else {
            _i4 = _iterator4.next();
            if (_i4.done) break;
            _ref5 = _i4.value;
          }

          const name = _ref5;

          if (!workspaceLayout.workspaces[name].loc) {
            continue;
          }

          const manifest = workspaceLayout.workspaces[name].manifest;

          if (manifest) {
            for (var _iterator5 = (_constants || _load_constants()).DEPENDENCY_TYPES, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
              var _ref6;

              if (_isArray5) {
                if (_i5 >= _iterator5.length) break;
                _ref6 = _iterator5[_i5++];
              } else {
                _i5 = _iterator5.next();
                if (_i5.done) break;
                _ref6 = _i5.value;
              }

              const dependencyType = _ref6;

              const dependencies = manifest[dependencyType];

              if (!dependencies) {
                continue;
              }

              for (var _iterator6 = Object.keys(dependencies), _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
                var _ref7;

                if (_isArray6) {
                  if (_i6 >= _iterator6.length) break;
                  _ref7 = _iterator6[_i6++];
                } else {
                  _i6 = _iterator6.next();
                  if (_i6.done) break;
                  _ref7 = _i6.value;
                }

                const dep = _ref7;

                result.topLevelPatterns.push(`${dep}@${dependencies[dep]}`);
              }
            }
          }
        }
      }

      result.topLevelPatterns.sort((_misc || _load_misc()).sortAlpha);

      if (flags.checkFiles) {
        result.flags.push('checkFiles');
      }

      if (flags.flat) {
        result.flags.push('flat');
      }

      if (_this3.config.ignoreScripts) {
        result.flags.push('ignoreScripts');
      }
      if (_this3.config.focus) {
        result.flags.push('focus: ' + _this3.config.focusedWorkspaceName);
      }

      if (_this3.config.production) {
        result.flags.push('production');
      }

      if (_this3.config.plugnplayEnabled) {
        result.flags.push('plugnplay');
      }

      const linkedModules = _this3.config.linkedModules;

      if (linkedModules.length) {
        result.linkedModules = linkedModules.sort((_misc || _load_misc()).sortAlpha);
      }

      for (var _iterator7 = Object.keys(lockfile), _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
        var _ref8;

        if (_isArray7) {
          if (_i7 >= _iterator7.length) break;
          _ref8 = _iterator7[_i7++];
        } else {
          _i7 = _iterator7.next();
          if (_i7.done) break;
          _ref8 = _i7.value;
        }

        const key = _ref8;

        result.lockfileEntries[key] = lockfile[key].resolved || '';
      }

      for (var _iterator8 = _this3._getModulesFolders({ workspaceLayout }), _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
        var _ref9;

        if (_isArray8) {
          if (_i8 >= _iterator8.length) break;
          _ref9 = _iterator8[_i8++];
        } else {
          _i8 = _iterator8.next();
          if (_i8.done) break;
          _ref9 = _i8.value;
        }

        const modulesFolder = _ref9;

        if (yield (_fs || _load_fs()).exists(modulesFolder)) {
          result.modulesFolders.push(path.relative(_this3.config.lockfileFolder, modulesFolder));
        }
      }

      if (flags.checkFiles) {
        const modulesRoot = _this3._getModulesRootFolder();

        result.files = (yield _this3._getIntegrityListing({ workspaceLayout })).map(function (entry) {
          return path.relative(modulesRoot, entry);
        }).sort((_misc || _load_misc()).sortAlpha);
      }

      return result;
    })();
  }

  _getIntegrityFile(locationPath) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const expectedRaw = yield (_fs || _load_fs()).readFile(locationPath);
      try {
        return (0, (_extends2 || _load_extends()).default)({}, INTEGRITY_FILE_DEFAULTS(), JSON.parse(expectedRaw));
      } catch (e) {
        // ignore JSON parsing for legacy text integrity files compatibility
      }
      return null;
    })();
  }

  _compareIntegrityFiles(actual, expected, checkFiles, workspaceLayout) {
    if (!expected) {
      return 'EXPECTED_IS_NOT_A_JSON';
    }

    if (!(0, (_misc || _load_misc()).compareSortedArrays)(actual.linkedModules, expected.linkedModules)) {
      return 'LINKED_MODULES_DONT_MATCH';
    }

    if (actual.systemParams !== expected.systemParams) {
      return 'SYSTEM_PARAMS_DONT_MATCH';
    }

    let relevantExpectedFlags = expected.flags.slice();

    // If we run "yarn" after "yarn --check-files", we shouldn't fail the less strict validation
    if (actual.flags.indexOf('checkFiles') === -1) {
      relevantExpectedFlags = relevantExpectedFlags.filter(flag => flag !== 'checkFiles');
    }

    if (!(0, (_misc || _load_misc()).compareSortedArrays)(actual.flags, relevantExpectedFlags)) {
      return 'FLAGS_DONT_MATCH';
    }

    if (!(0, (_misc || _load_misc()).compareSortedArrays)(actual.topLevelPatterns, expected.topLevelPatterns || [])) {
      return 'PATTERNS_DONT_MATCH';
    }

    for (var _iterator9 = Object.keys(actual.lockfileEntries), _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
      var _ref10;

      if (_isArray9) {
        if (_i9 >= _iterator9.length) break;
        _ref10 = _iterator9[_i9++];
      } else {
        _i9 = _iterator9.next();
        if (_i9.done) break;
        _ref10 = _i9.value;
      }

      const key = _ref10;

      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        return 'LOCKFILE_DONT_MATCH';
      }
    }

    for (var _iterator10 = Object.keys(expected.lockfileEntries), _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
      var _ref11;

      if (_isArray10) {
        if (_i10 >= _iterator10.length) break;
        _ref11 = _iterator10[_i10++];
      } else {
        _i10 = _iterator10.next();
        if (_i10.done) break;
        _ref11 = _i10.value;
      }

      const key = _ref11;

      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        return 'LOCKFILE_DONT_MATCH';
      }
    }

    if (checkFiles) {
      // Early bailout if we expect more files than what we have
      if (expected.files.length > actual.files.length) {
        return 'FILES_MISSING';
      }

      // Since we know the "files" array is sorted (alphabetically), we can optimize the thing
      // Instead of storing the files in a Set, we can just iterate both arrays at once. O(n)!
      for (let u = 0, v = 0; u < expected.files.length; ++u) {
        // Index that, if reached, means that we won't have enough food to match the remaining expected entries anyway
        const max = v + (actual.files.length - v) - (expected.files.length - u) + 1;

        // Skip over files that have been added (ie not present in 'expected')
        while (v < max && actual.files[v] !== expected.files[u]) {
          v += 1;
        }

        // If we've reached the index defined above, the file is either missing or we can early exit
        if (v === max) {
          return 'FILES_MISSING';
        }
      }
    }
    return 'OK';
  }

  check(patterns, lockfile, flags, workspaceLayout) {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // check if patterns exist in lockfile
      const missingPatterns = patterns.filter(function (p) {
        return !lockfile[p] && (!workspaceLayout || !workspaceLayout.getManifestByPattern(p));
      });

      const loc = yield _this4._getIntegrityFileLocation();
      if (missingPatterns.length || !loc.exists) {
        return {
          integrityFileMissing: !loc.exists,
          missingPatterns
        };
      }

      const actual = yield _this4._generateIntegrityFile(lockfile, patterns, flags, workspaceLayout);

      const expected = yield _this4._getIntegrityFile(loc.locationPath);
      let integrityMatches = _this4._compareIntegrityFiles(actual, expected, flags.checkFiles, workspaceLayout);

      if (integrityMatches === 'OK') {
        invariant(expected, "The integrity shouldn't pass without integrity file");
        for (var _iterator11 = expected.modulesFolders, _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
          var _ref12;

          if (_isArray11) {
            if (_i11 >= _iterator11.length) break;
            _ref12 = _iterator11[_i11++];
          } else {
            _i11 = _iterator11.next();
            if (_i11.done) break;
            _ref12 = _i11.value;
          }

          const modulesFolder = _ref12;

          if (!(yield (_fs || _load_fs()).exists(path.join(_this4.config.lockfileFolder, modulesFolder)))) {
            integrityMatches = 'MODULES_FOLDERS_MISSING';
          }
        }
      }

      return {
        integrityFileMissing: false,
        integrityMatches: integrityMatches === 'OK',
        integrityError: integrityMatches === 'OK' ? undefined : integrityMatches,
        missingPatterns,
        hardRefreshRequired: integrityMatches === 'SYSTEM_PARAMS_DONT_MATCH'
      };
    })();
  }

  /**
   * Get artifacts from integrity file if it exists.
   */
  getArtifacts() {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const loc = yield _this5._getIntegrityFileLocation();
      if (!loc.exists) {
        return null;
      }

      const expectedRaw = yield (_fs || _load_fs()).readFile(loc.locationPath);
      let expected;
      try {
        expected = JSON.parse(expectedRaw);
      } catch (e) {
        // ignore JSON parsing for legacy text integrity files compatibility
      }

      return expected ? expected.artifacts : null;
    })();
  }

  /**
   * Write the integrity hash of the current install to disk.
   */
  save(patterns, lockfile, flags, workspaceLayout, artifacts) {
    var _this6 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const integrityFile = yield _this6._generateIntegrityFile(lockfile, patterns, flags, workspaceLayout, artifacts);

      const loc = yield _this6._getIntegrityFileLocation();
      invariant(loc.locationPath, 'expected integrity hash location');

      yield (_fs || _load_fs()).mkdirp(path.dirname(loc.locationPath));
      yield (_fs || _load_fs()).writeFile(loc.locationPath, JSON.stringify(integrityFile, null, 2));
    })();
  }

  removeIntegrityFile() {
    var _this7 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const loc = yield _this7._getIntegrityFileLocation();
      if (loc.exists) {
        yield (_fs || _load_fs()).unlink(loc.locationPath);
      }
    })();
  }
}
exports.default = InstallationIntegrityChecker;