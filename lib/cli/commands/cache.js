'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.examples = exports.run = exports.getCachedPackagesDirs = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getCachedPackagesDirs = exports.getCachedPackagesDirs = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, currentPath) {
    const results = [];
    const stat = yield (_fs || _load_fs()).lstat(currentPath);

    if (!stat.isDirectory()) {
      return results;
    }

    const folders = yield (_fs || _load_fs()).readdir(currentPath);
    for (var _iterator = folders, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref2 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref2 = _i.value;
      }

      const folder = _ref2;

      if (folder[0] === '.') {
        continue;
      }
      const packageParentPath = path.join(currentPath, folder, 'node_modules');

      const candidates = yield (_fs || _load_fs()).readdir(packageParentPath);
      invariant(candidates.length === 1, `There should only be one folder in a package cache (got ${candidates.join(',')} in ${packageParentPath})`);

      for (var _iterator2 = candidates, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const candidate = _ref3;

        const candidatePath = path.join(packageParentPath, candidate);
        if (candidate.charAt(0) === '@') {
          const subCandidates = yield (_fs || _load_fs()).readdir(candidatePath);
          invariant(subCandidates.length === 1, `There should only be one folder in a package cache (got ${subCandidates.join(',')} in ${candidatePath})`);

          for (var _iterator3 = subCandidates, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
            var _ref4;

            if (_isArray3) {
              if (_i3 >= _iterator3.length) break;
              _ref4 = _iterator3[_i3++];
            } else {
              _i3 = _iterator3.next();
              if (_i3.done) break;
              _ref4 = _i3.value;
            }

            const subCandidate = _ref4;

            const subCandidatePath = path.join(candidatePath, subCandidate);
            results.push(subCandidatePath);
          }
        } else {
          results.push(candidatePath);
        }
      }
    }

    return results;
  });

  return function getCachedPackagesDirs(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

let getCachedPackages = (() => {
  var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    const paths = yield getCachedPackagesDirs(config, config.cacheFolder);
    return _getMetadataWithPath(config.readPackageMetadata.bind(config), paths).then(function (packages) {
      return packages.filter(function (p) {
        return !!p;
      });
    });
  });

  return function getCachedPackages(_x3) {
    return _ref5.apply(this, arguments);
  };
})();

let list = (() => {
  var _ref6 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const filterOut = function filterOut({ registry, package: manifest, remote } = {}) {
      if (flags.pattern && !micromatch.contains(manifest.name, flags.pattern)) {
        return false;
      }
      return true;
    };

    const forReport = function forReport({ registry, package: manifest, remote } = {}) {
      return [manifest.name, manifest.version, registry, remote && remote.resolved || ''];
    };

    const packages = yield getCachedPackages(config);
    const body = packages.filter(filterOut).map(forReport);
    reporter.table(['Name', 'Version', 'Registry', 'Resolved'], body);
  });

  return function list(_x4, _x5, _x6, _x7) {
    return _ref6.apply(this, arguments);
  };
})();

let clean = (() => {
  var _ref7 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (config.cacheFolder) {
      const activity = reporter.activity();

      if (args.length > 0) {
        // Clear named packages from cache
        const packages = yield getCachedPackages(config);
        const shouldDelete = function shouldDelete({ registry, package: manifest, remote } = {}) {
          return args.indexOf(manifest.name) !== -1;
        };
        const packagesToDelete = packages.filter(shouldDelete);

        for (var _iterator4 = packagesToDelete, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
          var _ref8;

          if (_isArray4) {
            if (_i4 >= _iterator4.length) break;
            _ref8 = _iterator4[_i4++];
          } else {
            _i4 = _iterator4.next();
            if (_i4.done) break;
            _ref8 = _i4.value;
          }

          const manifest = _ref8;

          let relativePath = path.relative(config.cacheFolder, manifest._path);
          while (relativePath && relativePath !== '.') {
            yield (_fs || _load_fs()).unlink(path.resolve(config.cacheFolder, relativePath));
            relativePath = path.dirname(relativePath);
          }
        }

        activity.end();
        reporter.success(reporter.lang('clearedPackageFromCache', args[0]));
      } else {
        // Clear all cache
        yield (_fs || _load_fs()).unlink(config._cacheRootFolder);
        yield (_fs || _load_fs()).mkdirp(config.cacheFolder);
        activity.end();
        reporter.success(reporter.lang('clearedCache'));
      }
    }
  });

  return function clean(_x8, _x9, _x10, _x11) {
    return _ref7.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _buildSubCommands2;

function _load_buildSubCommands() {
  return _buildSubCommands2 = _interopRequireDefault(require('./_build-sub-commands.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');
const path = require('path');
const micromatch = require('micromatch');

function hasWrapper(flags, args) {
  return args[0] !== 'dir';
}

function _getMetadataWithPath(getMetadataFn, paths) {
  return Promise.all(paths.map(path => getMetadataFn(path).then(r => {
    r._path = path;
    return r;
  }).catch(error => undefined)));
}

var _buildSubCommands = (0, (_buildSubCommands2 || _load_buildSubCommands()).default)('cache', {
  ls(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      reporter.warn(`\`yarn cache ls\` is deprecated. Please use \`yarn cache list\`.`);
      yield list(config, reporter, flags, args);
    })();
  },
  list,
  clean,
  dir(config, reporter) {
    reporter.log(config.cacheFolder, { force: true });
  }
});

const run = _buildSubCommands.run,
      _setFlags = _buildSubCommands.setFlags,
      examples = _buildSubCommands.examples;
exports.run = run;
exports.examples = examples;
function setFlags(commander) {
  _setFlags(commander);
  commander.description('Yarn cache list will print out every cached package.');
  commander.option('--pattern [pattern]', 'filter cached packages by pattern');
}