'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.clean = exports.noArguments = exports.requireLockfile = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let clean = exports.clean = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter) {
    const loc = path.join(config.lockfileFolder, (_constants || _load_constants()).CLEAN_FILENAME);
    const file = yield (_fs || _load_fs()).readFile(loc);
    const lines = file.split('\n');
    const filters = (0, (_filter || _load_filter()).ignoreLinesToRegex)(lines);

    let removedFiles = 0;
    let removedSize = 0;

    // build list of possible module folders
    const locs = new Set();
    for (var _iterator = config.registryFolders, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref2 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref2 = _i.value;
      }

      const registryFolder = _ref2;

      locs.add(path.resolve(config.lockfileFolder, registryFolder));
    }

    const workspaceRootFolder = config.workspaceRootFolder;
    if (workspaceRootFolder) {
      const manifest = yield config.findManifest(workspaceRootFolder, false);
      invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

      const workspaces = yield config.resolveWorkspaces(workspaceRootFolder, manifest);

      for (var _iterator2 = Object.keys(workspaces), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const workspaceName = _ref3;

        for (var _iterator3 = (_index || _load_index()).registryNames, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
          var _ref4;

          if (_isArray3) {
            if (_i3 >= _iterator3.length) break;
            _ref4 = _iterator3[_i3++];
          } else {
            _i3 = _iterator3.next();
            if (_i3.done) break;
            _ref4 = _i3.value;
          }

          const name = _ref4;

          const registry = config.registries[name];
          locs.add(path.join(workspaces[workspaceName].loc, registry.folder));
        }
      }
    }

    for (var _iterator4 = locs, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref5;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref5 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref5 = _i4.value;
      }

      const folder = _ref5;

      if (!(yield (_fs || _load_fs()).exists(folder))) {
        continue;
      }

      const spinner = reporter.activity();
      const files = yield (_fs || _load_fs()).walk(folder);

      var _sortFilter = (0, (_filter || _load_filter()).sortFilter)(files, filters);

      const ignoreFiles = _sortFilter.ignoreFiles;

      spinner.end();

      const tick = reporter.progress(ignoreFiles.size);
      // TODO make sure `main` field of all modules isn't ignored

      for (var _iterator5 = ignoreFiles, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray5) {
          if (_i5 >= _iterator5.length) break;
          _ref6 = _iterator5[_i5++];
        } else {
          _i5 = _iterator5.next();
          if (_i5.done) break;
          _ref6 = _i5.value;
        }

        const file = _ref6;

        const loc = path.join(folder, file);
        const stat = yield (_fs || _load_fs()).lstat(loc);
        removedSize += stat.size;
        removedFiles++;
      }

      for (var _iterator6 = ignoreFiles, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
        var _ref7;

        if (_isArray6) {
          if (_i6 >= _iterator6.length) break;
          _ref7 = _iterator6[_i6++];
        } else {
          _i6 = _iterator6.next();
          if (_i6.done) break;
          _ref7 = _i6.value;
        }

        const file = _ref7;

        const loc = path.join(folder, file);
        yield (_fs || _load_fs()).unlink(loc);
        tick();
      }
    }

    return { removedFiles, removedSize };
  });

  return function clean(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

let runInit = (() => {
  var _ref8 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (cwd, reporter) {
    reporter.step(1, 1, reporter.lang('cleanCreatingFile', (_constants || _load_constants()).CLEAN_FILENAME));
    const cleanLoc = path.join(cwd, (_constants || _load_constants()).CLEAN_FILENAME);
    yield (_fs || _load_fs()).writeFile(cleanLoc, `${DEFAULT_FILTER}\n`, { flag: 'wx' });
    reporter.info(reporter.lang('cleanCreatedFile', (_constants || _load_constants()).CLEAN_FILENAME));
  });

  return function runInit(_x3, _x4) {
    return _ref8.apply(this, arguments);
  };
})();

let runAutoClean = (() => {
  var _ref9 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter) {
    reporter.step(1, 1, reporter.lang('cleaning'));

    var _ref10 = yield clean(config, reporter);

    const removedFiles = _ref10.removedFiles,
          removedSize = _ref10.removedSize;

    reporter.info(reporter.lang('cleanRemovedFiles', removedFiles));
    reporter.info(reporter.lang('cleanSavedSize', Number((removedSize / 1024 / 1024).toFixed(2))));
  });

  return function runAutoClean(_x5, _x6) {
    return _ref9.apply(this, arguments);
  };
})();

let checkForCleanFile = (() => {
  var _ref11 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (cwd) {
    const cleanLoc = path.join(cwd, (_constants || _load_constants()).CLEAN_FILENAME);
    const exists = yield (_fs || _load_fs()).exists(cleanLoc);
    return exists;
  });

  return function checkForCleanFile(_x7) {
    return _ref11.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref12 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const cleanFileExists = yield checkForCleanFile(config.cwd);

    if (flags.init && cleanFileExists) {
      reporter.info(reporter.lang('cleanAlreadyExists', (_constants || _load_constants()).CLEAN_FILENAME));
    } else if (flags.init) {
      yield runInit(config.cwd, reporter);
    } else if (flags.force && cleanFileExists) {
      yield runAutoClean(config, reporter);
    } else if (cleanFileExists) {
      reporter.info(reporter.lang('cleanRequiresForce', (_constants || _load_constants()).CLEAN_FILENAME));
    } else {
      reporter.info(reporter.lang('cleanDoesNotExist', (_constants || _load_constants()).CLEAN_FILENAME));
    }
  });

  return function run(_x8, _x9, _x10, _x11) {
    return _ref12.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _index;

function _load_index() {
  return _index = require('../../registries/index.js');
}

var _filter;

function _load_filter() {
  return _filter = require('../../util/filter.js');
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');
const path = require('path');

const requireLockfile = exports.requireLockfile = true;
const noArguments = exports.noArguments = true;

const DEFAULT_FILTER = `
# test directories
__tests__
test
tests
powered-test

# asset directories
docs
doc
website
images
assets

# examples
example
examples

# code coverage directories
coverage
.nyc_output

# build scripts
Makefile
Gulpfile.js
Gruntfile.js

# configs
appveyor.yml
circle.yml
codeship-services.yml
codeship-steps.yml
wercker.yml
.tern-project
.gitattributes
.editorconfig
.*ignore
.eslintrc
.jshintrc
.flowconfig
.documentup.json
.yarn-metadata.json
.travis.yml

# misc
*.md
`.trim();

function setFlags(commander) {
  commander.description('Cleans and removes unnecessary files from package dependencies.');
  commander.usage('autoclean [flags]');
  commander.option('-I, --init', `Create "${(_constants || _load_constants()).CLEAN_FILENAME}" file with the default entries.`);
  commander.option('-F, --force', `Run autoclean using the existing "${(_constants || _load_constants()).CLEAN_FILENAME}" file.`);
}

function hasWrapper(commander) {
  return true;
}