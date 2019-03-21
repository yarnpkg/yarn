'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.requireLockfile = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let cleanQuery = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, query) {
    // if a location was passed then turn it into a hash query
    if (path.isAbsolute(query) && (yield (_fs || _load_fs()).exists(query))) {
      // absolute path
      query = path.relative(config.cwd, query);
    }

    // remove references to node_modules with hashes
    query = query.replace(/([\\/]|^)node_modules[\\/]/g, '#');

    // remove trailing hashes
    query = query.replace(/^#+/g, '');

    // remove trailing paths from each part of the query, skip second part of path for scoped packages
    let queryParts = query.split('#');
    queryParts = queryParts.map(function (part) {
      let parts = part.split(/[\\/]/g);

      if (part[0] === '@') {
        parts = parts.slice(0, 2);
      } else {
        parts = parts.slice(0, 1);
      }

      return parts.join('/');
    });
    query = queryParts.join('#');

    return query;
  });

  return function cleanQuery(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

let getPackageSize = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (tuple) {
    const loc = tuple[0];


    const files = yield (_fs || _load_fs()).walk(loc, null, new Set([(_constants || _load_constants()).METADATA_FILENAME, (_constants || _load_constants()).TARBALL_FILENAME]));

    const sizes = yield Promise.all(files.map(function (walkFile) {
      return (_fs || _load_fs()).getFileSizeOnDisk(walkFile.absolute);
    }));

    return sum(sizes);
  });

  return function getPackageSize(_x3) {
    return _ref2.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref6 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (!args.length) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('missingWhyDependency'));
    }
    if (args.length > 1) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('tooManyArguments', 1));
    }

    const query = yield cleanQuery(config, args[0]);

    reporter.step(1, 4, reporter.lang('whyStart', args[0]), emoji.get('thinking_face'));

    // init
    reporter.step(2, 4, reporter.lang('whyInitGraph'), emoji.get('truck'));
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder, reporter);
    const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);

    var _ref7 = yield install.fetchRequestFromCwd();

    const depRequests = _ref7.requests,
          patterns = _ref7.patterns,
          workspaceLayout = _ref7.workspaceLayout;

    yield install.resolver.init(depRequests, {
      isFlat: install.flags.flat,
      isFrozen: install.flags.frozenLockfile,
      workspaceLayout
    });
    const hoisted = yield install.linker.getFlatHoistedTree(patterns);

    // finding
    reporter.step(3, 4, reporter.lang('whyFinding'), emoji.get('mag'));

    const matches = queryWhy(query, hoisted);

    if (matches.length <= 0) {
      reporter.error(reporter.lang('whyUnknownMatch'));
      return;
    }

    const processMatch = (() => {
      var _ref8 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (match) {
        const matchInfo = match[1];

        const matchRef = matchInfo.pkg._reference;
        invariant(matchRef, 'expected reference');

        const distinctMatchPatterns = new Set(matchRef.patterns);
        const reasons = [];

        // reason: dependency of these modules
        if (matchInfo.originalParentPath.length > 0) {
          reasons.push({
            type: 'whyDependedOn',
            typeSimple: 'whyDependedOnSimple',
            value: toStandardPathString(matchInfo.originalParentPath)
          });
        }

        // reason: exists in manifest
        let rootType;
        for (var _iterator3 = distinctMatchPatterns, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
          var _ref9;

          if (_isArray3) {
            if (_i3 >= _iterator3.length) break;
            _ref9 = _iterator3[_i3++];
          } else {
            _i3 = _iterator3.next();
            if (_i3.done) break;
            _ref9 = _i3.value;
          }

          const pattern = _ref9;

          rootType = install.rootPatternsToOrigin[pattern];
          if (rootType) {
            reasons.push({
              type: 'whySpecified',
              typeSimple: 'whySpecifiedSimple',
              value: rootType
            });
          }
        }

        // reason: this is hoisted from these modules
        for (var _iterator4 = matchInfo.previousPaths, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
          var _ref10;

          if (_isArray4) {
            if (_i4 >= _iterator4.length) break;
            _ref10 = _iterator4[_i4++];
          } else {
            _i4 = _iterator4.next();
            if (_i4.done) break;
            _ref10 = _i4.value;
          }

          const path = _ref10;

          reasons.push({
            type: 'whyHoistedFrom',
            typeSimple: 'whyHoistedFromSimple',
            value: toStandardPathString(path)
          });
        }

        // package sizes
        let packageSize = 0;
        let directSizes = [];
        let transitiveSizes = [];
        try {
          packageSize = yield getPackageSize(match);
        } catch (e) {}

        const dependencies = Array.from(collect(hoisted, new Set(), match));
        const transitiveDependencies = Array.from(collect(hoisted, new Set(), match, { recursive: true }));

        try {
          directSizes = yield Promise.all(dependencies.map(getPackageSize));
          transitiveSizes = yield Promise.all(transitiveDependencies.map(getPackageSize));
        } catch (e) {}

        const transitiveKeys = new Set(transitiveDependencies.map(function ([, info]) {
          return info.key;
        }));
        const sharedDependencies = getSharedDependencies(hoisted, transitiveKeys);

        // prepare output: populate reporter
        reporter.info(reporter.lang('whyMatch', `${matchInfo.key}@${matchInfo.pkg.version}`));
        //
        // reason: hoisted/nohoist
        if (matchInfo.isNohoist) {
          reasons.push({
            type: 'whyNotHoisted',
            typeSimple: 'whyNotHoistedSimple',
            value: matchInfo.nohoistList
          });
        } else if (query === matchInfo.originalKey) {
          reporter.info(reporter.lang('whyHoistedTo', matchInfo.key));
        }

        if (reasons.length === 1) {
          reporter.info(reporter.lang(reasons[0].typeSimple, reasons[0].value));
        } else if (reasons.length > 1) {
          reporter.info(reporter.lang('whyReasons'));
          reporter.list('reasons', reasons.map(function (reason) {
            return reporter.lang(reason.type, reason.value);
          }));
        } else {
          reporter.error(reporter.lang('whyWhoKnows'));
        }

        if (packageSize) {
          // stats: file size of this dependency without any dependencies
          reporter.info(reporter.lang('whyDiskSizeWithout', bytes(packageSize)));

          // stats: file size of this dependency including dependencies that aren't shared
          reporter.info(reporter.lang('whyDiskSizeUnique', bytes(packageSize + sum(directSizes))));

          // stats: file size of this dependency including dependencies
          reporter.info(reporter.lang('whyDiskSizeTransitive', bytes(packageSize + sum(transitiveSizes))));

          // stats: shared transitive dependencies
          reporter.info(reporter.lang('whySharedDependencies', sharedDependencies.size));
        }
      });

      return function processMatch(_x8) {
        return _ref8.apply(this, arguments);
      };
    })();

    reporter.step(4, 4, reporter.lang('whyCalculating'), emoji.get('aerial_tramway'));
    for (var _iterator5 = matches, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
      var _ref11;

      if (_isArray5) {
        if (_i5 >= _iterator5.length) break;
        _ref11 = _iterator5[_i5++];
      } else {
        _i5 = _iterator5.next();
        if (_i5.done) break;
        _ref11 = _i5.value;
      }

      const match = _ref11;

      yield processMatch(match);
    }
  });

  return function run(_x4, _x5, _x6, _x7) {
    return _ref6.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;
exports.queryWhy = queryWhy;

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const requireLockfile = exports.requireLockfile = true;

const invariant = require('invariant');
const bytes = require('bytes');
const emoji = require('node-emoji');
const path = require('path');

function sum(array) {
  return array.length ? array.reduce((a, b) => a + b, 0) : 0;
}

function collect(hoistManifests, allDependencies, dependency, { recursive } = { recursive: false }) {
  const depInfo = dependency[1];

  const deps = depInfo.pkg.dependencies;

  if (!deps) {
    return allDependencies;
  }

  const dependencyKeys = new Set(Object.keys(deps));
  const directDependencies = [];

  for (var _iterator = hoistManifests, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref3;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref3 = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref3 = _i.value;
    }

    const dep = _ref3;
    const info = dep[1];


    if (!allDependencies.has(dep) && dependencyKeys.has(info.key)) {
      allDependencies.add(dep);
      directDependencies.push(dep);
    }
  }

  if (recursive) {
    directDependencies.forEach(dependency => collect(hoistManifests, allDependencies, dependency, { recursive: true }));
  }

  return allDependencies;
}

function getSharedDependencies(hoistManifests, transitiveKeys) {
  const sharedDependencies = new Set();
  for (var _iterator2 = hoistManifests, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
    var _ref5;

    if (_isArray2) {
      if (_i2 >= _iterator2.length) break;
      _ref5 = _iterator2[_i2++];
    } else {
      _i2 = _iterator2.next();
      if (_i2.done) break;
      _ref5 = _i2.value;
    }

    const _ref4 = _ref5;
    const info = _ref4[1];

    if (!transitiveKeys.has(info.key) && info.pkg.dependencies) {
      Object.keys(info.pkg.dependencies).forEach(dependency => {
        if (transitiveKeys.has(dependency) && !sharedDependencies.has(dependency)) {
          sharedDependencies.add(dependency);
        }
      });
    }
  }
  return sharedDependencies;
}

function setFlags(commander) {
  commander.description('Identifies why a package has been installed, detailing which other packages depend on it.');
}

function hasWrapper(commander, args) {
  return true;
}

// to conform to the current standard '#' as package tree separator
function toStandardPathString(pathString) {
  const str = pathString.replace(/\//g, '#');
  if (str[0] === '#') {
    return str.slice(1);
  }
  return str;
}

function queryWhy(pattern, hoisted) {
  const nohoistPattern = `#${pattern}`;
  const found = [];
  for (var _iterator6 = hoisted, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
    var _ref13;

    if (_isArray6) {
      if (_i6 >= _iterator6.length) break;
      _ref13 = _iterator6[_i6++];
    } else {
      _i6 = _iterator6.next();
      if (_i6.done) break;
      _ref13 = _i6.value;
    }

    const _ref12 = _ref13;
    const loc = _ref12[0];
    const info = _ref12[1];

    if (info.key === pattern || info.previousPaths.indexOf(pattern) >= 0 || info.key.endsWith(nohoistPattern)) {
      found.push([loc, info]);
    }
  }
  return found;
}