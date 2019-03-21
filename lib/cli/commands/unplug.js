'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clearAll = exports.clearSome = exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (!config.plugnplayEnabled) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('unplugDisabled'));
    }
    if (!args.length && flags.clear) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('tooFewArguments', 1));
    }
    if (args.length && flags.clearAll) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('noArguments'));
    }

    if (flags.clearAll) {
      yield clearAll(config);
    } else if (flags.clear) {
      yield clearSome(config, new Set(args));
    } else if (args.length > 0) {
      const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder, reporter);
      yield (0, (_install || _load_install()).wrapLifecycle)(config, flags, (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
        const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);
        install.linker.unplugged = args;
        yield install.init();
      }));
    }

    const unpluggedPackageFolders = yield config.listUnpluggedPackageFolders();

    for (var _iterator = unpluggedPackageFolders.values(), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref3;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref3 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref3 = _i.value;
      }

      const target = _ref3;

      reporter.log(target, { force: true });
    }
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let clearSome = exports.clearSome = (() => {
  var _ref4 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, filters) {
    const unpluggedPackageFolders = yield config.listUnpluggedPackageFolders();
    const removeList = [];

    for (var _iterator2 = unpluggedPackageFolders.entries(), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref6;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref6 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref6 = _i2.value;
      }

      const _ref5 = _ref6;
      const unpluggedName = _ref5[0];
      const target = _ref5[1];

      var _ref8 = yield (_fs || _load_fs()).readJson(path.join(target, 'package.json'));

      const name = _ref8.name;

      const toBeRemoved = filters.has(name);

      if (toBeRemoved) {
        removeList.push(path.join(config.getUnpluggedPath(), unpluggedName));
      }
    }

    if (removeList.length === unpluggedPackageFolders.size) {
      yield (_fs || _load_fs()).unlink(config.getUnpluggedPath());
    } else {
      for (var _iterator3 = removeList, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref7;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref7 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref7 = _i3.value;
        }

        const unpluggedPackagePath = _ref7;

        yield (_fs || _load_fs()).unlink(unpluggedPackagePath);
      }
    }
  });

  return function clearSome(_x5, _x6) {
    return _ref4.apply(this, arguments);
  };
})();

let clearAll = exports.clearAll = (() => {
  var _ref9 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    yield (_fs || _load_fs()).unlink(config.getUnpluggedPath());
  });

  return function clearAll(_x7) {
    return _ref9.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

function hasWrapper(commander) {
  return true;
}

function setFlags(commander) {
  commander.description('Temporarily copies a package (with an optional @range suffix) outside of the global cache for debugging purposes');
  commander.usage('unplug [packages ...] [flags]');
  commander.option('--clear', 'Delete the selected packages');
  commander.option('--clear-all', 'Delete all unplugged packages');
}