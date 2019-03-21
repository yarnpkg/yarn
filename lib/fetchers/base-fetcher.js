'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _index;

function _load_index() {
  return _index = _interopRequireDefault(require('../util/normalize-manifest/index.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../constants.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../util/fs.js'));
}

var _mutex;

function _load_mutex() {
  return _mutex = _interopRequireDefault(require('../util/mutex.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint no-unused-vars: 0 */

const cmdShim = require('@zkochan/cmd-shim');
const path = require('path');

class BaseFetcher {
  constructor(dest, remote, config) {
    this.reporter = config.reporter;
    this.packageName = remote.packageName;
    this.reference = remote.reference;
    this.registry = remote.registry;
    this.hash = remote.hash;
    this.remote = remote;
    this.config = config;
    this.dest = dest;
  }

  setupMirrorFromCache() {
    // fetcher subclasses may use this to perform actions such as copying over a cached tarball to the offline
    // mirror etc
    return Promise.resolve();
  }

  _fetch() {
    return Promise.reject(new Error('Not implemented'));
  }

  fetch(defaultManifest) {
    var _this = this;

    return (_fs || _load_fs()).lockQueue.push(this.dest, (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield (_fs || _load_fs()).mkdirp(_this.dest);

      // fetch package and get the hash

      var _ref2 = yield _this._fetch();

      const hash = _ref2.hash;


      const pkg = yield (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
        // load the new normalized manifest
        try {
          return yield _this.config.readManifest(_this.dest, _this.registry);
        } catch (e) {
          if (e.code === 'ENOENT' && defaultManifest) {
            return (0, (_index || _load_index()).default)(defaultManifest, _this.dest, _this.config, false);
          } else {
            throw e;
          }
        }
      })();

      if (pkg.bin) {
        for (var _iterator = Object.keys(pkg.bin), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
          var _ref4;

          if (_isArray) {
            if (_i >= _iterator.length) break;
            _ref4 = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done) break;
            _ref4 = _i.value;
          }

          const binName = _ref4;

          const binDest = `${_this.dest}/.bin`;

          // Using any sort of absolute path here would prevent makePortableProxyScript from preserving symlinks when
          // calling the binary
          const src = path.resolve(_this.dest, pkg.bin[binName]);

          if (yield (_fs || _load_fs()).exists(src)) {
            // We ensure that the target is executable
            yield (_fs || _load_fs()).chmod(src, 0o755);
          }

          yield (_fs || _load_fs()).mkdirp(binDest);
          if (process.platform === 'win32') {
            const unlockMutex = yield (0, (_mutex || _load_mutex()).default)(src);
            try {
              yield cmdShim.ifExists(src, `${binDest}/${binName}`, { createPwshFile: false });
            } finally {
              unlockMutex();
            }
          } else {
            yield (_fs || _load_fs()).symlink(src, `${binDest}/${binName}`);
          }
        }
      }

      yield (_fs || _load_fs()).writeFile(path.join(_this.dest, (_constants || _load_constants()).METADATA_FILENAME), JSON.stringify({
        manifest: pkg,
        artifacts: [],
        remote: _this.remote,
        registry: _this.registry,
        hash
      }, null, '  '));

      return {
        hash,
        dest: _this.dest,
        package: pkg,
        cached: false
      };
    }));
  }
}
exports.default = BaseFetcher;