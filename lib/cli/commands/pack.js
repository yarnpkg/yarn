'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.pack = exports.packTarball = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let packTarball = exports.packTarball = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, { mapHeader } = {}) {
    const pkg = yield config.readRootManifest();
    const bundleDependencies = pkg.bundleDependencies,
          main = pkg.main,
          onlyFiles = pkg.files;

    // include required files

    let filters = NEVER_IGNORE.slice();
    // include default filters unless `files` is used
    if (!onlyFiles) {
      filters = filters.concat(DEFAULT_IGNORE);
    }
    if (main) {
      filters = filters.concat((0, (_filter || _load_filter()).ignoreLinesToRegex)(['!/' + main]));
    }

    // include bundleDependencies
    let bundleDependenciesFiles = [];
    if (bundleDependencies) {
      for (var _iterator = bundleDependencies, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref2;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref2 = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref2 = _i.value;
        }

        const dependency = _ref2;

        const dependencyList = depsFor(dependency, config.cwd);

        for (var _iterator2 = dependencyList, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
          var _ref3;

          if (_isArray2) {
            if (_i2 >= _iterator2.length) break;
            _ref3 = _iterator2[_i2++];
          } else {
            _i2 = _iterator2.next();
            if (_i2.done) break;
            _ref3 = _i2.value;
          }

          const dep = _ref3;

          const filesForBundledDep = yield (_fs || _load_fs()).walk(dep.baseDir, null, new Set(FOLDERS_IGNORE));
          bundleDependenciesFiles = bundleDependenciesFiles.concat(filesForBundledDep);
        }
      }
    }

    // `files` field
    if (onlyFiles) {
      let lines = ['*'];
      lines = lines.concat(onlyFiles.map(function (filename) {
        return `!${filename}`;
      }), onlyFiles.map(function (filename) {
        return `!${path.join(filename, '**')}`;
      }));
      const regexes = (0, (_filter || _load_filter()).ignoreLinesToRegex)(lines, './');
      filters = filters.concat(regexes);
    }

    const files = yield (_fs || _load_fs()).walk(config.cwd, null, new Set(FOLDERS_IGNORE));
    const dotIgnoreFiles = (0, (_filter || _load_filter()).filterOverridenGitignores)(files);

    // create ignores
    for (var _iterator3 = dotIgnoreFiles, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref4 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref4 = _i3.value;
      }

      const file = _ref4;

      const raw = yield (_fs || _load_fs()).readFile(file.absolute);
      const lines = raw.split('\n');

      const regexes = (0, (_filter || _load_filter()).ignoreLinesToRegex)(lines, path.dirname(file.relative));
      filters = filters.concat(regexes);
    }

    // files to definitely keep, takes precedence over ignore filter
    const keepFiles = new Set();

    // files to definitely ignore
    const ignoredFiles = new Set();

    // list of files that didn't match any of our patterns, if a directory in the chain above was matched
    // then we should inherit it
    const possibleKeepFiles = new Set();

    // apply filters
    (0, (_filter || _load_filter()).sortFilter)(files, filters, keepFiles, possibleKeepFiles, ignoredFiles);

    // add the files for the bundled dependencies to the set of files to keep
    for (var _iterator4 = bundleDependenciesFiles, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref5;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref5 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref5 = _i4.value;
      }

      const file = _ref5;

      const realPath = yield (_fs || _load_fs()).realpath(config.cwd);
      keepFiles.add(path.relative(realPath, file.absolute));
    }

    return packWithIgnoreAndHeaders(config.cwd, function (name) {
      const relative = path.relative(config.cwd, name);
      // Don't ignore directories, since we need to recurse inside them to check for unignored files.
      if (fs2.lstatSync(name).isDirectory()) {
        const isParentOfKeptFile = Array.from(keepFiles).some(function (name) {
          return !path.relative(relative, name).startsWith('..');
        });
        return !isParentOfKeptFile;
      }
      // Otherwise, ignore a file if we're not supposed to keep it.
      return !keepFiles.has(relative);
    }, { mapHeader });
  });

  return function packTarball(_x) {
    return _ref.apply(this, arguments);
  };
})();

let pack = exports.pack = (() => {
  var _ref6 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    const packer = yield packTarball(config);
    const compressor = packer.pipe(new zlib.Gzip());

    return compressor;
  });

  return function pack(_x2) {
    return _ref6.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref7 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const pkg = yield config.readRootManifest();
    if (!pkg.name) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('noName'));
    }
    if (!pkg.version) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('noVersion'));
    }

    const normaliseScope = function normaliseScope(name) {
      return name[0] === '@' ? name.substr(1).replace('/', '-') : name;
    };
    const filename = flags.filename || path.join(config.cwd, `${normaliseScope(pkg.name)}-v${pkg.version}.tgz`);

    yield config.executeLifecycleScript('prepack');

    const stream = yield pack(config);

    yield new Promise(function (resolve, reject) {
      stream.pipe(fs2.createWriteStream(filename));
      stream.on('error', reject);
      stream.on('close', resolve);
    });

    yield config.executeLifecycleScript('postpack');

    reporter.success(reporter.lang('packWroteTarball', filename));
  });

  return function run(_x3, _x4, _x5, _x6) {
    return _ref7.apply(this, arguments);
  };
})();

exports.packWithIgnoreAndHeaders = packWithIgnoreAndHeaders;
exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _filter;

function _load_filter() {
  return _filter = require('../../util/filter.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const zlib = require('zlib');
const path = require('path');
const tar = require('tar-fs');
const fs2 = require('fs');
const depsFor = require('hash-for-dep/lib/deps-for');

const FOLDERS_IGNORE = [
// never allow version control folders
'.git', 'CVS', '.svn', '.hg', 'node_modules'];

const DEFAULT_IGNORE = (0, (_filter || _load_filter()).ignoreLinesToRegex)([...FOLDERS_IGNORE,

// ignore cruft
'yarn.lock', '.lock-wscript', '.wafpickle-{0..9}', '*.swp', '._*', 'npm-debug.log', 'yarn-error.log', '.npmrc', '.yarnrc', '.npmignore', '.gitignore', '.DS_Store']);

const NEVER_IGNORE = (0, (_filter || _load_filter()).ignoreLinesToRegex)([
// never ignore these files
'!/package.json', '!/readme*', '!/+(license|licence)*', '!/+(changes|changelog|history)*']);

function packWithIgnoreAndHeaders(cwd, ignoreFunction, { mapHeader } = {}) {
  return tar.pack(cwd, {
    ignore: ignoreFunction,
    map: header => {
      const suffix = header.name === '.' ? '' : `/${header.name}`;
      header.name = `package${suffix}`;
      delete header.uid;
      delete header.gid;
      return mapHeader ? mapHeader(header) : header;
    }
  });
}

function setFlags(commander) {
  commander.description('Creates a compressed gzip archive of package dependencies.');
  commander.option('-f, --filename <filename>', 'filename');
}

function hasWrapper(commander, args) {
  return true;
}