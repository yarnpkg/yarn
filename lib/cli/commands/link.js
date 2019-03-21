'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.getRegistryFolder = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getRegistryFolder = exports.getRegistryFolder = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, name) {
    if (config.modulesFolder) {
      return config.modulesFolder;
    }

    const src = path.join(config.linkFolder, name);

    var _ref2 = yield config.readManifest(src);

    const _registry = _ref2._registry;

    invariant(_registry, 'expected registry');

    const registryFolder = config.registries[_registry].folder;
    return path.join(config.cwd, registryFolder);
  });

  return function getRegistryFolder(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref3 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (args.length) {
      for (var _iterator = args, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref4 = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref4 = _i.value;
        }

        const name = _ref4;

        const src = path.join(config.linkFolder, name);

        if (yield (_fs || _load_fs()).exists(src)) {
          const folder = yield getRegistryFolder(config, name);
          const dest = path.join(folder, name);

          yield (_fs || _load_fs()).unlink(dest);
          yield (_fs || _load_fs()).mkdirp(path.dirname(dest));
          yield (_fs || _load_fs()).symlink(src, dest);
          reporter.success(reporter.lang('linkUsing', name));
        } else {
          throw new (_errors || _load_errors()).MessageError(reporter.lang('linkMissing', name));
        }
      }
    } else {
      // add cwd module to the global registry
      const manifest = yield config.readRootManifest();
      const name = manifest.name;
      if (!name) {
        throw new (_errors || _load_errors()).MessageError(reporter.lang('unknownPackageName'));
      }

      const linkLoc = path.join(config.linkFolder, name);
      if (yield (_fs || _load_fs()).exists(linkLoc)) {
        reporter.warn(reporter.lang('linkCollision', name));
      } else {
        yield (_fs || _load_fs()).mkdirp(path.dirname(linkLoc));
        yield (_fs || _load_fs()).symlink(config.cwd, linkLoc);

        // If there is a `bin` defined in the package.json,
        // link each bin to the global bin
        if (manifest.bin) {
          const globalBinFolder = yield (0, (_global || _load_global()).getBinFolder)(config, flags);
          for (const binName in manifest.bin) {
            const binSrc = manifest.bin[binName];
            const binSrcLoc = path.join(linkLoc, binSrc);
            const binDestLoc = path.join(globalBinFolder, binName);
            if (yield (_fs || _load_fs()).exists(binDestLoc)) {
              reporter.warn(reporter.lang('binLinkCollision', binName));
            } else {
              if (process.platform === 'win32') {
                yield cmdShim(binSrcLoc, binDestLoc, { createPwshFile: false });
              } else {
                yield (_fs || _load_fs()).symlink(binSrcLoc, binDestLoc);
              }
            }
          }
        }

        reporter.success(reporter.lang('linkRegistered', name));
        reporter.info(reporter.lang('linkRegisteredMessage', name));
      }
    }
  });

  return function run(_x3, _x4, _x5, _x6) {
    return _ref3.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _global;

function _load_global() {
  return _global = require('./global');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const cmdShim = require('@zkochan/cmd-shim');
const path = require('path');

function hasWrapper(commander, args) {
  return true;
}

function setFlags(commander) {
  commander.description('Symlink a package folder during development.');
}