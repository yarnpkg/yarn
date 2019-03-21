'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (args.length) {
      for (var _iterator = args, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref2;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref2 = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref2 = _i.value;
        }

        const name = _ref2;

        const linkLoc = path.join(config.linkFolder, name);
        if (yield (_fs || _load_fs()).exists(linkLoc)) {
          yield (_fs || _load_fs()).unlink(path.join((yield (0, (_link || _load_link()).getRegistryFolder)(config, name)), name));
          reporter.success(reporter.lang('linkDisusing', name));
          reporter.info(reporter.lang('linkDisusingMessage', name));
        } else {
          throw new (_errors || _load_errors()).MessageError(reporter.lang('linkMissing', name));
        }
      }
    } else {
      // remove from registry
      const manifest = yield config.readRootManifest();
      const name = manifest.name;
      if (!name) {
        throw new (_errors || _load_errors()).MessageError(reporter.lang('unknownPackageName'));
      }

      const linkLoc = path.join(config.linkFolder, name);
      if (yield (_fs || _load_fs()).exists(linkLoc)) {
        // If there is a `bin` defined in the package.json,
        // link each bin to the global bin
        if (manifest.bin) {
          const globalBinFolder = yield (0, (_global || _load_global()).getBinFolder)(config, flags);
          for (const binName in manifest.bin) {
            const binDestLoc = path.join(globalBinFolder, binName);
            if (yield (_fs || _load_fs()).exists(binDestLoc)) {
              yield (_fs || _load_fs()).unlink(binDestLoc);
              if (process.platform === 'win32') {
                yield (_fs || _load_fs()).unlink(binDestLoc + '.cmd');
              }
            }
          }
        }

        yield (_fs || _load_fs()).unlink(linkLoc);

        reporter.success(reporter.lang('linkUnregistered', name));
        reporter.info(reporter.lang('linkUnregisteredMessage', name));
      } else {
        throw new (_errors || _load_errors()).MessageError(reporter.lang('linkMissing', name));
      }
    }
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _link;

function _load_link() {
  return _link = require('./link.js');
}

var _global;

function _load_global() {
  return _global = require('./global');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

function setFlags(commander) {
  commander.description('Unlink a previously created symlink for a package.');
}

function hasWrapper(commander, args) {
  return true;
}