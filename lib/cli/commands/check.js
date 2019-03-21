'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.verifyTreeCheck = exports.noArguments = exports.requireLockfile = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let verifyTreeCheck = exports.verifyTreeCheck = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    let errCount = 0;
    function reportError(msg, ...vars) {
      reporter.error(reporter.lang(msg, ...vars));
      errCount++;
    }
    // check all dependencies recursively without relying on internal resolver
    const registryName = 'yarn';
    const registryFolder = config.registryFolders[0];
    const cwd = config.workspaceRootFolder ? config.lockfileFolder : config.cwd;
    const rootManifest = yield config.readManifest(cwd, registryName);

    const dependenciesToCheckVersion = [];
    if (rootManifest.dependencies) {
      for (const name in rootManifest.dependencies) {
        const version = rootManifest.dependencies[name];
        // skip linked dependencies
        const isLinkedDependency = /^link:/i.test(version) || /^file:/i.test(version) && config.linkFileDependencies;
        if (isLinkedDependency) {
          continue;
        }
        dependenciesToCheckVersion.push({
          name,
          originalKey: name,
          parentCwd: cwd,
          version
        });
      }
    }
    if (rootManifest.devDependencies && !config.production) {
      for (const name in rootManifest.devDependencies) {
        const version = rootManifest.devDependencies[name];
        // skip linked dependencies
        const isLinkedDependency = /^link:/i.test(version) || /^file:/i.test(version) && config.linkFileDependencies;
        if (isLinkedDependency) {
          continue;
        }
        dependenciesToCheckVersion.push({
          name,
          originalKey: name,
          parentCwd: cwd,
          version
        });
      }
    }

    const locationsVisited = new Set();
    while (dependenciesToCheckVersion.length) {
      const dep = dependenciesToCheckVersion.shift();
      const manifestLoc = path.resolve(dep.parentCwd, registryFolder, dep.name);
      if (locationsVisited.has(manifestLoc + `@${dep.version}`)) {
        continue;
      }
      locationsVisited.add(manifestLoc + `@${dep.version}`);
      // When plugnplay is enabled, packages aren't copied to the node_modules folder, so this check doesn't make sense
      // TODO: We ideally should check that the packages are located inside the cache instead
      if (config.plugnplayEnabled) {
        continue;
      }
      if (!(yield (_fs || _load_fs()).exists(manifestLoc))) {
        reportError('packageNotInstalled', `${dep.originalKey}`);
        continue;
      }
      if (!(yield (_fs || _load_fs()).exists(path.join(manifestLoc, 'package.json')))) {
        continue;
      }
      const pkg = yield config.readManifest(manifestLoc, registryName);
      if (semver.validRange(dep.version, config.looseSemver) && !semver.satisfies(pkg.version, dep.version, config.looseSemver)) {
        reportError('packageWrongVersion', dep.originalKey, dep.version, pkg.version);
        continue;
      }
      const dependencies = pkg.dependencies;
      if (dependencies) {
        for (const subdep in dependencies) {
          const subDepPath = path.resolve(manifestLoc, registryFolder, subdep);
          let found = false;
          const relative = path.relative(cwd, subDepPath);
          const locations = path.normalize(relative).split(registryFolder + path.sep).filter(function (dir) {
            return !!dir;
          });
          locations.pop();
          while (locations.length >= 0) {
            let possiblePath;
            if (locations.length > 0) {
              possiblePath = path.join(cwd, registryFolder, locations.join(path.sep + registryFolder + path.sep));
            } else {
              possiblePath = cwd;
            }
            if (yield (_fs || _load_fs()).exists(path.resolve(possiblePath, registryFolder, subdep))) {
              dependenciesToCheckVersion.push({
                name: subdep,
                originalKey: `${dep.originalKey}#${subdep}`,
                parentCwd: possiblePath,
                version: dependencies[subdep]
              });
              found = true;
              break;
            }
            if (!locations.length) {
              break;
            }
            locations.pop();
          }
          if (!found) {
            reportError('packageNotInstalled', `${dep.originalKey}#${subdep}`);
          }
        }
      }
    }

    if (errCount > 0) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('foundErrors', errCount));
    } else {
      reporter.success(reporter.lang('folderInSync'));
    }
  });

  return function verifyTreeCheck(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let integrityHashCheck = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    let errCount = 0;
    function reportError(msg, ...vars) {
      reporter.error(reporter.lang(msg, ...vars));
      errCount++;
    }
    const integrityChecker = new (_integrityChecker || _load_integrityChecker()).default(config);

    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.cwd);
    const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);

    // get patterns that are installed when running `yarn install`

    var _ref3 = yield install.fetchRequestFromCwd();

    const patterns = _ref3.patterns,
          workspaceLayout = _ref3.workspaceLayout;


    const match = yield integrityChecker.check(patterns, lockfile.cache, flags, workspaceLayout);
    for (var _iterator = match.missingPatterns, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref4 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref4 = _i.value;
      }

      const pattern = _ref4;

      reportError('lockfileNotContainPattern', pattern);
    }
    if (match.integrityFileMissing) {
      reportError('noIntegrityFile');
    }
    if (match.integrityMatches === false) {
      reporter.warn(reporter.lang((_integrityChecker2 || _load_integrityChecker2()).integrityErrors[match.integrityError]));
      reportError('integrityCheckFailed');
    }

    if (errCount > 0) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('foundErrors', errCount));
    } else {
      reporter.success(reporter.lang('folderInSync'));
    }
  });

  return function integrityHashCheck(_x5, _x6, _x7, _x8) {
    return _ref2.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (flags.verifyTree) {
      yield verifyTreeCheck(config, reporter, flags, args);
      return;
    } else if (flags.integrity) {
      yield integrityHashCheck(config, reporter, flags, args);
      return;
    }

    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.cwd);
    const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);

    function humaniseLocation(loc) {
      const relative = path.relative(path.join(config.cwd, 'node_modules'), loc);
      const normalized = path.normalize(relative).split(path.sep);
      return normalized.filter(p => p !== 'node_modules').reduce((result, part) => {
        const length = result.length;
        if (length && result[length - 1].startsWith('@') && result[length - 1].indexOf(path.sep) === -1) {
          result[length - 1] += path.sep + part;
        } else {
          result.push(part);
        }
        return result;
      }, []);
    }

    let warningCount = 0;
    let errCount = 0;
    function reportError(msg, ...vars) {
      reporter.error(reporter.lang(msg, ...vars));
      errCount++;
    }

    // get patterns that are installed when running `yarn install`

    var _ref6 = yield install.hydrate();

    const rawPatterns = _ref6.patterns,
          workspaceLayout = _ref6.workspaceLayout;

    const patterns = yield install.flatten(rawPatterns);

    // check if patterns exist in lockfile
    for (var _iterator2 = patterns, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref7 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref7 = _i2.value;
      }

      const pattern = _ref7;

      if (!lockfile.getLocked(pattern) && (!workspaceLayout || !workspaceLayout.getManifestByPattern(pattern))) {
        reportError('lockfileNotContainPattern', pattern);
      }
    }

    const bundledDeps = {};
    // check if any of the node_modules are out of sync
    const res = yield install.linker.getFlatHoistedTree(patterns, workspaceLayout);
    for (var _iterator3 = res, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref9;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref9 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref9 = _i3.value;
      }

      const _ref8 = _ref9;
      const loc = _ref8[0];
      var _ref8$ = _ref8[1];
      const originalKey = _ref8$.originalKey;
      const pkg = _ref8$.pkg;
      const ignore = _ref8$.ignore;

      if (ignore) {
        continue;
      }

      const parts = humaniseLocation(loc);

      // grey out hoisted portions of key
      let human = originalKey;
      const hoistedParts = parts.slice();
      const hoistedKey = parts.join('#');
      if (human !== hoistedKey) {
        const humanParts = human.split('#');

        for (let i = 0; i < humanParts.length; i++) {
          const humanPart = humanParts[i];

          if (hoistedParts[0] === humanPart) {
            hoistedParts.shift();

            if (i < humanParts.length - 1) {
              humanParts[i] += '#';
            }
          } else {
            humanParts[i] = reporter.format.dim(`${humanPart}#`);
          }
        }

        human = humanParts.join('');
      }

      // skip unnecessary checks for linked dependencies
      const remoteType = pkg._reference.remote.type;
      const isLinkedDependency = remoteType === 'link' || remoteType === 'workspace' || remoteType === 'file' && config.linkFileDependencies;
      if (isLinkedDependency) {
        continue;
      }

      if (!(yield (_fs || _load_fs()).exists(loc))) {
        if (pkg._reference.optional) {
          reporter.warn(reporter.lang('optionalDepNotInstalled', human));
        } else {
          reportError('packageNotInstalled', human);
        }
        continue;
      }

      const pkgLoc = path.join(loc, 'package.json');

      if (yield (_fs || _load_fs()).exists(pkgLoc)) {
        const packageJson = yield config.readJson(pkgLoc);
        packageJson.version = semver.clean(packageJson.version);

        if (pkg.version !== packageJson.version) {
          // node_modules contains wrong version
          reportError('packageWrongVersion', human, pkg.version, packageJson.version);
        }

        const deps = Object.assign({}, packageJson.dependencies, packageJson.peerDependencies);
        bundledDeps[packageJson.name] = packageJson.bundledDependencies || [];

        for (const name in deps) {
          const range = deps[name];
          if (!semver.validRange(range, config.looseSemver)) {
            continue; // exotic
          }

          const subHuman = `${human}#${name}@${range}`;

          // find the package that this will resolve to, factoring in hoisting
          const possibles = [];
          let depLoc;
          for (let i = parts.length; i >= 0; i--) {
            const myParts = parts.slice(0, i).concat(name);

            // build package.json location for this position
            const myDepPkgLoc = path.join(config.cwd, 'node_modules', myParts.join(`${path.sep}node_modules${path.sep}`));

            possibles.push(myDepPkgLoc);
          }
          while (possibles.length) {
            const myDepPkgLoc = possibles.shift();
            if (yield (_fs || _load_fs()).exists(myDepPkgLoc)) {
              depLoc = myDepPkgLoc;
              break;
            }
          }
          if (!depLoc) {
            // we'll hit the module not install error above when this module is hit
            continue;
          }

          const depPkgLoc = path.join(depLoc, 'package.json');

          if (yield (_fs || _load_fs()).exists(depPkgLoc)) {
            const depPkg = yield config.readJson(depPkgLoc);
            const foundHuman = `${humaniseLocation(path.dirname(depPkgLoc)).join('#')}@${depPkg.version}`;
            if (!semver.satisfies(depPkg.version, range, config.looseSemver)) {
              // module isn't correct semver
              const resPattern = install.resolutionMap.find(name, originalKey.split('#'));
              if (resPattern) {
                const resHuman = `${human}#${resPattern}`;

                var _normalizePattern = (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(resPattern);

                const resRange = _normalizePattern.range;


                if (semver.satisfies(depPkg.version, resRange, config.looseSemver)) {
                  reporter.warn(reporter.lang('incompatibleResolutionVersion', foundHuman, subHuman));
                  warningCount++;
                } else {
                  reportError('packageDontSatisfy', resHuman, foundHuman);
                }
              } else {
                reportError('packageDontSatisfy', subHuman, foundHuman);
              }

              continue;
            }

            // check for modules above us that this could be deduped to
            for (var _iterator4 = possibles, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
              var _ref10;

              if (_isArray4) {
                if (_i4 >= _iterator4.length) break;
                _ref10 = _iterator4[_i4++];
              } else {
                _i4 = _iterator4.next();
                if (_i4.done) break;
                _ref10 = _i4.value;
              }

              const loc = _ref10;

              const locPkg = path.join(loc, 'package.json');

              if (!(yield (_fs || _load_fs()).exists(locPkg))) {
                continue;
              }

              const packageJson = yield config.readJson(locPkg);
              const packagePath = originalKey.split('#');
              const rootDep = packagePath[0];
              const packageName = packagePath[1] || packageJson.name;

              const bundledDep = bundledDeps[rootDep] && bundledDeps[rootDep].indexOf(packageName) !== -1;
              if (!bundledDep && (packageJson.version === depPkg.version || semver.satisfies(packageJson.version, range, config.looseSemver) && semver.gt(packageJson.version, depPkg.version, config.looseSemver))) {
                reporter.warn(reporter.lang('couldBeDeduped', subHuman, packageJson.version, `${humaniseLocation(path.dirname(locPkg)).join('#')}@${packageJson.version}`));
                warningCount++;
              }
              break;
            }
          }
        }
      }
    }

    if (warningCount > 1) {
      reporter.info(reporter.lang('foundWarnings', warningCount));
    }

    if (errCount > 0) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('foundErrors', errCount));
    } else {
      reporter.success(reporter.lang('folderInSync'));
    }
  });

  return function run(_x9, _x10, _x11, _x12) {
    return _ref5.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _integrityChecker;

function _load_integrityChecker() {
  return _integrityChecker = _interopRequireDefault(require('../../integrity-checker.js'));
}

var _integrityChecker2;

function _load_integrityChecker2() {
  return _integrityChecker2 = require('../../integrity-checker.js');
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _normalizePattern2;

function _load_normalizePattern() {
  return _normalizePattern2 = require('../../util/normalize-pattern.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const semver = require('semver');
const path = require('path');

const requireLockfile = exports.requireLockfile = false;
const noArguments = exports.noArguments = true;

function hasWrapper(commander) {
  return true;
}

function setFlags(commander) {
  commander.description('Verifies if versions in the current project’s package.json match that of yarn’s lock file.');
  commander.option('--integrity');
  commander.option('--verify-tree');
}