'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.getBinFolder = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let updateCwd = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    yield (_fs || _load_fs()).mkdirp(config.globalFolder);

    yield config.init({
      cwd: config.globalFolder,
      binLinks: true,
      globalFolder: config.globalFolder,
      cacheFolder: config._cacheRootFolder,
      linkFolder: config.linkFolder,
      enableDefaultRc: config.enableDefaultRc,
      extraneousYarnrcFiles: config.extraneousYarnrcFiles
    });
  });

  return function updateCwd(_x) {
    return _ref2.apply(this, arguments);
  };
})();

let getBins = (() => {
  var _ref3 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    // build up list of registry folders to search for binaries
    const dirs = [];
    for (var _iterator2 = Object.keys((_index || _load_index()).registries), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref4 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref4 = _i2.value;
      }

      const registryName = _ref4;

      const registry = config.registries[registryName];
      dirs.push(registry.loc);
    }

    // build up list of binary files
    const paths = new Set();
    for (var _iterator3 = dirs, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref5;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref5 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref5 = _i3.value;
      }

      const dir = _ref5;

      const binDir = path.join(dir, '.bin');
      if (!(yield (_fs || _load_fs()).exists(binDir))) {
        continue;
      }

      for (var _iterator4 = yield (_fs || _load_fs()).readdir(binDir), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray4) {
          if (_i4 >= _iterator4.length) break;
          _ref6 = _iterator4[_i4++];
        } else {
          _i4 = _iterator4.next();
          if (_i4.done) break;
          _ref6 = _i4.value;
        }

        const name = _ref6;

        paths.add(path.join(binDir, name));
      }
    }
    return paths;
  });

  return function getBins(_x2) {
    return _ref3.apply(this, arguments);
  };
})();

let getGlobalPrefix = (() => {
  var _ref7 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, flags) {
    if (flags.prefix) {
      return flags.prefix;
    } else if (config.getOption('prefix', true)) {
      return String(config.getOption('prefix', true));
    } else if (process.env.PREFIX) {
      return process.env.PREFIX;
    }

    const potentialPrefixFolders = [(_constants || _load_constants()).FALLBACK_GLOBAL_PREFIX];
    if (process.platform === 'win32') {
      // %LOCALAPPDATA%\Yarn --> C:\Users\Alice\AppData\Local\Yarn
      if (process.env.LOCALAPPDATA) {
        potentialPrefixFolders.unshift(path.join(process.env.LOCALAPPDATA, 'Yarn'));
      }
    } else {
      potentialPrefixFolders.unshift((_constants || _load_constants()).POSIX_GLOBAL_PREFIX);
    }

    const binFolders = potentialPrefixFolders.map(function (prefix) {
      return path.join(prefix, 'bin');
    });
    const prefixFolderQueryResult = yield (_fs || _load_fs()).getFirstSuitableFolder(binFolders);
    const prefix = prefixFolderQueryResult.folder && path.dirname(prefixFolderQueryResult.folder);

    if (!prefix) {
      config.reporter.warn(config.reporter.lang('noGlobalFolder', prefixFolderQueryResult.skipped.map(function (item) {
        return path.dirname(item.folder);
      }).join(', ')));

      return (_constants || _load_constants()).FALLBACK_GLOBAL_PREFIX;
    }

    return prefix;
  });

  return function getGlobalPrefix(_x3, _x4) {
    return _ref7.apply(this, arguments);
  };
})();

let getBinFolder = exports.getBinFolder = (() => {
  var _ref8 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, flags) {
    const prefix = yield getGlobalPrefix(config, flags);
    return path.resolve(prefix, 'bin');
  });

  return function getBinFolder(_x5, _x6) {
    return _ref8.apply(this, arguments);
  };
})();

let initUpdateBins = (() => {
  var _ref9 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags) {
    const beforeBins = yield getBins(config);
    const binFolder = yield getBinFolder(config, flags);

    function throwPermError(err, dest) {
      if (err.code === 'EACCES') {
        throw new (_errors || _load_errors()).MessageError(reporter.lang('noPermission', dest));
      } else {
        throw err;
      }
    }

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      try {
        yield (_fs || _load_fs()).mkdirp(binFolder);
      } catch (err) {
        throwPermError(err, binFolder);
      }

      const afterBins = yield getBins(config);

      // remove old bins
      for (var _iterator5 = beforeBins, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
        var _ref11;

        if (_isArray5) {
          if (_i5 >= _iterator5.length) break;
          _ref11 = _iterator5[_i5++];
        } else {
          _i5 = _iterator5.next();
          if (_i5.done) break;
          _ref11 = _i5.value;
        }

        const src = _ref11;

        if (afterBins.has(src)) {
          // not old
          continue;
        }

        // remove old bin
        const dest = path.join(binFolder, path.basename(src));
        try {
          yield (_fs || _load_fs()).unlink(dest);
        } catch (err) {
          throwPermError(err, dest);
        }
      }

      // add new bins
      for (var _iterator6 = afterBins, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
        var _ref12;

        if (_isArray6) {
          if (_i6 >= _iterator6.length) break;
          _ref12 = _iterator6[_i6++];
        } else {
          _i6 = _iterator6.next();
          if (_i6.done) break;
          _ref12 = _i6.value;
        }

        const src = _ref12;

        // insert new bin
        const dest = path.join(binFolder, path.basename(src));
        try {
          yield (_fs || _load_fs()).unlink(dest);
          yield (0, (_packageLinker || _load_packageLinker()).linkBin)(src, dest);
          if (process.platform === 'win32' && dest.indexOf('.cmd') !== -1) {
            yield (_fs || _load_fs()).rename(dest + '.cmd', dest);
          }
        } catch (err) {
          throwPermError(err, dest);
        }
      }
    });
  });

  return function initUpdateBins(_x7, _x8, _x9) {
    return _ref9.apply(this, arguments);
  };
})();

let list = (() => {
  var _ref13 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    yield updateCwd(config);

    // install so we get hard file paths
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.cwd);
    const install = new (_install || _load_install()).Install({}, config, new (_baseReporter || _load_baseReporter()).default(), lockfile);
    const patterns = yield install.getFlattenedDeps();

    // dump global modules
    for (var _iterator7 = patterns, _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
      var _ref14;

      if (_isArray7) {
        if (_i7 >= _iterator7.length) break;
        _ref14 = _iterator7[_i7++];
      } else {
        _i7 = _iterator7.next();
        if (_i7.done) break;
        _ref14 = _i7.value;
      }

      const pattern = _ref14;

      const manifest = install.resolver.getStrictResolvedPattern(pattern);
      ls(manifest, reporter, false);
    }
  });

  return function list(_x10, _x11, _x12, _x13) {
    return _ref13.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _index;

function _load_index() {
  return _index = require('../../registries/index.js');
}

var _baseReporter;

function _load_baseReporter() {
  return _baseReporter = _interopRequireDefault(require('../../reporters/base-reporter.js'));
}

var _buildSubCommands2;

function _load_buildSubCommands() {
  return _buildSubCommands2 = _interopRequireDefault(require('./_build-sub-commands.js'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _add;

function _load_add() {
  return _add = require('./add.js');
}

var _remove;

function _load_remove() {
  return _remove = require('./remove.js');
}

var _upgrade;

function _load_upgrade() {
  return _upgrade = require('./upgrade.js');
}

var _upgradeInteractive;

function _load_upgradeInteractive() {
  return _upgradeInteractive = require('./upgrade-interactive.js');
}

var _packageLinker;

function _load_packageLinker() {
  return _packageLinker = require('../../package-linker.js');
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

class GlobalAdd extends (_add || _load_add()).Add {
  constructor(args, flags, config, reporter, lockfile) {
    super(args, flags, config, reporter, lockfile);

    this.linker.setTopLevelBinLinking(false);
  }

  maybeOutputSaveTree() {
    for (var _iterator = this.addedPatterns, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
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

      const manifest = this.resolver.getStrictResolvedPattern(pattern);
      ls(manifest, this.reporter, true);
    }
    return Promise.resolve();
  }

  _logSuccessSaveLockfile() {
    // noop
  }
}

const path = require('path');

function hasWrapper(flags, args) {
  return args[0] !== 'bin' && args[0] !== 'dir';
}

function ls(manifest, reporter, saved) {
  const bins = manifest.bin ? Object.keys(manifest.bin) : [];
  const human = `${manifest.name}@${manifest.version}`;
  if (bins.length) {
    if (saved) {
      reporter.success(reporter.lang('packageInstalledWithBinaries', human));
    } else {
      reporter.info(reporter.lang('packageHasBinaries', human));
    }
    reporter.list(`bins-${manifest.name}`, bins);
  } else if (saved) {
    reporter.warn(reporter.lang('packageHasNoBinaries', human));
  }
}

var _buildSubCommands = (0, (_buildSubCommands2 || _load_buildSubCommands()).default)('global', {
  add(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield updateCwd(config);

      const updateBins = yield initUpdateBins(config, reporter, flags);
      if (args.indexOf('yarn') !== -1) {
        reporter.warn(reporter.lang('packageContainsYarnAsGlobal'));
      }

      // install module
      const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.cwd);
      const install = new GlobalAdd(args, flags, config, reporter, lockfile);
      yield install.init();

      // link binaries
      yield updateBins();
    })();
  },

  bin(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      reporter.log((yield getBinFolder(config, flags)), { force: true });
    })();
  },

  dir(config, reporter, flags, args) {
    reporter.log(config.globalFolder, { force: true });
    return Promise.resolve();
  },

  ls(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      reporter.warn(`\`yarn global ls\` is deprecated. Please use \`yarn global list\`.`);
      yield list(config, reporter, flags, args);
    })();
  },

  list(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield list(config, reporter, flags, args);
    })();
  },

  remove(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield updateCwd(config);

      const updateBins = yield initUpdateBins(config, reporter, flags);

      // remove module
      yield (0, (_remove || _load_remove()).run)(config, reporter, flags, args);

      // remove binaries
      yield updateBins();
    })();
  },

  upgrade(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield updateCwd(config);

      const updateBins = yield initUpdateBins(config, reporter, flags);

      // upgrade module
      yield (0, (_upgrade || _load_upgrade()).run)(config, reporter, flags, args);

      // update binaries
      yield updateBins();
    })();
  },

  upgradeInteractive(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield updateCwd(config);

      const updateBins = yield initUpdateBins(config, reporter, flags);

      // upgrade module
      yield (0, (_upgradeInteractive || _load_upgradeInteractive()).run)(config, reporter, flags, args);

      // update binaries
      yield updateBins();
    })();
  }
});

const run = _buildSubCommands.run,
      _setFlags = _buildSubCommands.setFlags;
exports.run = run;
function setFlags(commander) {
  _setFlags(commander);
  commander.description('Installs packages globally on your operating system.');
  commander.option('--prefix <prefix>', 'bin prefix to use to install binaries');
  commander.option('--latest', 'upgrade to the latest version of packages');
}