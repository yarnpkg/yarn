'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LocalTarballFetcher = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../constants.js'));
}

var _baseFetcher;

function _load_baseFetcher() {
  return _baseFetcher = _interopRequireDefault(require('./base-fetcher.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../util/fs.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('../util/misc.js');
}

var _normalizeUrl;

function _load_normalizeUrl() {
  return _normalizeUrl = _interopRequireDefault(require('normalize-url'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const crypto = require('crypto');
const path = require('path');
const tarFs = require('tar-fs');
const url = require('url');
const fs = require('fs');
const stream = require('stream');
const gunzip = require('gunzip-maybe');
const invariant = require('invariant');
const ssri = require('ssri');

const RE_URL_NAME_MATCH = /\/(?:(@[^/]+)\/)?[^/]+\/-\/(?:@[^/]+\/)?([^/]+)$/;

const isHashAlgorithmSupported = name => {
  const cachedResult = isHashAlgorithmSupported.__cache[name];
  if (cachedResult != null) {
    return cachedResult;
  }
  let supported = true;
  try {
    crypto.createHash(name);
  } catch (error) {
    if (error.message !== 'Digest method not supported') {
      throw error;
    }
    supported = false;
  }

  isHashAlgorithmSupported.__cache[name] = supported;
  return supported;
};
isHashAlgorithmSupported.__cache = {};

class TarballFetcher extends (_baseFetcher || _load_baseFetcher()).default {
  constructor(...args) {
    var _temp;

    return _temp = super(...args), this.validateError = null, this.validateIntegrity = null, _temp;
  }

  setupMirrorFromCache() {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const tarballMirrorPath = _this.getTarballMirrorPath();
      const tarballCachePath = _this.getTarballCachePath();

      if (tarballMirrorPath == null) {
        return;
      }

      if (!(yield (_fs || _load_fs()).exists(tarballMirrorPath)) && (yield (_fs || _load_fs()).exists(tarballCachePath))) {
        // The tarball doesn't exists in the offline cache but does in the cache; we import it to the mirror
        yield (_fs || _load_fs()).mkdirp(path.dirname(tarballMirrorPath));
        yield (_fs || _load_fs()).copy(tarballCachePath, tarballMirrorPath, _this.reporter);
      }
    })();
  }

  getTarballCachePath() {
    return path.join(this.dest, (_constants || _load_constants()).TARBALL_FILENAME);
  }

  getTarballMirrorPath() {
    var _url$parse = url.parse(this.reference);

    const pathname = _url$parse.pathname;


    if (pathname == null) {
      return null;
    }

    const match = pathname.match(RE_URL_NAME_MATCH);

    let packageFilename;
    if (match) {
      const scope = match[1],
            tarballBasename = match[2];

      packageFilename = scope ? `${scope}-${tarballBasename}` : tarballBasename;
    } else {
      // fallback to base name
      packageFilename = path.basename(pathname);
    }

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  createExtractor(resolve, reject, tarballPath) {
    const integrityInfo = this._supportedIntegrity();

    const now = new Date();

    const fs = require('fs');
    const patchedFs = Object.assign({}, fs, {
      utimes: (path, atime, mtime, cb) => {
        fs.stat(path, (err, stat) => {
          if (err) {
            cb(err);
            return;
          }
          if (stat.isDirectory()) {
            fs.utimes(path, atime, mtime, cb);
            return;
          }
          fs.open(path, 'a', (err, fd) => {
            if (err) {
              cb(err);
              return;
            }
            fs.futimes(fd, atime, mtime, err => {
              if (err) {
                fs.close(fd, () => cb(err));
              } else {
                fs.close(fd, err => cb(err));
              }
            });
          });
        });
      }
    });

    const validateStream = new ssri.integrityStream(integrityInfo);
    const untarStream = tarFs.extract(this.dest, {
      strip: 1,
      dmode: 0o755, // all dirs should be readable
      fmode: 0o644, // all files should be readable
      chown: false, // don't chown. just leave as it is
      map: header => {
        header.mtime = now;
        return header;
      },
      fs: patchedFs
    });
    const extractorStream = gunzip();

    validateStream.once('error', err => {
      this.validateError = err;
    });
    validateStream.once('integrity', sri => {
      this.validateIntegrity = sri;
    });

    untarStream.on('error', err => {
      reject(new (_errors || _load_errors()).MessageError(this.config.reporter.lang('errorExtractingTarball', err.message, tarballPath)));
    });

    extractorStream.pipe(untarStream).on('finish', () => {
      const error = this.validateError;
      const hexDigest = this.validateIntegrity ? this.validateIntegrity.hexDigest() : '';
      if (this.config.updateChecksums && this.remote.integrity && this.validateIntegrity && this.remote.integrity !== this.validateIntegrity.toString()) {
        this.remote.integrity = this.validateIntegrity.toString();
      }

      if (integrityInfo.algorithms.length === 0) {
        return reject(new (_errors || _load_errors()).SecurityError(this.config.reporter.lang('fetchBadIntegrityAlgorithm', this.packageName, this.remote.reference)));
      }

      if (error) {
        if (this.config.updateChecksums) {
          this.remote.integrity = error.found.toString();
        } else {
          return reject(new (_errors || _load_errors()).SecurityError(this.config.reporter.lang('fetchBadHashWithPath', this.packageName, this.remote.reference, error.found.toString(), error.expected.toString())));
        }
      }

      return resolve({
        hash: this.hash || hexDigest
      });
    });

    return { validateStream, extractorStream };
  }

  getLocalPaths(override) {
    const paths = [override ? path.resolve(this.config.cwd, override) : null, this.getTarballMirrorPath(), this.getTarballCachePath()];
    // $FlowFixMe: https://github.com/facebook/flow/issues/1414
    return paths.filter(path => path != null);
  }

  fetchFromLocal(override) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const tarPaths = _this2.getLocalPaths(override);
      const stream = yield (_fs || _load_fs()).readFirstAvailableStream(tarPaths);

      return new Promise(function (resolve, reject) {
        if (!stream) {
          reject(new (_errors || _load_errors()).MessageError(_this2.reporter.lang('tarballNotInNetworkOrCache', _this2.reference, tarPaths)));
          return;
        }
        invariant(stream, 'stream should be available at this point');
        // $FlowFixMe - This is available https://nodejs.org/api/fs.html#fs_readstream_path
        const tarballPath = stream.path;

        var _createExtractor = _this2.createExtractor(resolve, reject, tarballPath);

        const validateStream = _createExtractor.validateStream,
              extractorStream = _createExtractor.extractorStream;


        stream.pipe(validateStream).pipe(extractorStream).on('error', function (err) {
          reject(new (_errors || _load_errors()).MessageError(_this2.config.reporter.lang('fetchErrorCorrupt', err.message, tarballPath)));
        });
      });
    })();
  }

  fetchFromExternal() {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const registry = _this3.config.registries[_this3.registry];

      try {
        const headers = _this3.requestHeaders();
        return yield registry.request(_this3.reference, {
          headers: (0, (_extends2 || _load_extends()).default)({
            'Accept-Encoding': 'gzip'
          }, headers),
          buffer: true,
          process: function process(req, resolve, reject) {
            // should we save this to the offline cache?
            const tarballMirrorPath = _this3.getTarballMirrorPath();
            const tarballCachePath = _this3.getTarballCachePath();

            var _createExtractor2 = _this3.createExtractor(resolve, reject);

            const validateStream = _createExtractor2.validateStream,
                  extractorStream = _createExtractor2.extractorStream;


            req.pipe(validateStream);

            if (tarballMirrorPath) {
              validateStream.pipe(fs.createWriteStream(tarballMirrorPath)).on('error', reject);
            }

            if (tarballCachePath) {
              validateStream.pipe(fs.createWriteStream(tarballCachePath)).on('error', reject);
            }

            validateStream.pipe(extractorStream).on('error', reject);
          }
        }, _this3.packageName);
      } catch (err) {
        const tarballMirrorPath = _this3.getTarballMirrorPath();
        const tarballCachePath = _this3.getTarballCachePath();

        if (tarballMirrorPath && (yield (_fs || _load_fs()).exists(tarballMirrorPath))) {
          yield (_fs || _load_fs()).unlink(tarballMirrorPath);
        }

        if (tarballCachePath && (yield (_fs || _load_fs()).exists(tarballCachePath))) {
          yield (_fs || _load_fs()).unlink(tarballCachePath);
        }

        throw err;
      }
    })();
  }

  requestHeaders() {
    const registry = this.config.registries.yarn;
    const config = registry.config;
    const requestParts = urlParts(this.reference);
    return Object.keys(config).reduce((headers, option) => {
      const parts = option.split(':');
      if (parts.length === 3 && parts[1] === '_header') {
        const registryParts = urlParts(parts[0]);
        if (requestParts.host === registryParts.host && requestParts.path.startsWith(registryParts.path)) {
          const headerName = parts[2];
          const headerValue = config[option];
          headers[headerName] = headerValue;
        }
      }
      return headers;
    }, {});
  }

  _fetch() {
    const isFilePath = this.reference.startsWith('file:');
    this.reference = (0, (_misc || _load_misc()).removePrefix)(this.reference, 'file:');
    const urlParse = url.parse(this.reference);

    // legacy support for local paths in yarn.lock entries
    const isRelativePath = urlParse.protocol ? urlParse.protocol.match(/^[a-z]:$/i) : urlParse.pathname ? urlParse.pathname.match(/^(?:\.{1,2})?[\\\/]/) : false;

    if (isFilePath || isRelativePath) {
      return this.fetchFromLocal(this.reference);
    }

    return this.fetchFromLocal().catch(err => this.fetchFromExternal());
  }

  _findIntegrity() {
    if (this.remote.integrity) {
      return ssri.parse(this.remote.integrity);
    }
    if (this.hash) {
      return ssri.fromHex(this.hash, 'sha1');
    }
    return null;
  }

  _supportedIntegrity() {
    const expectedIntegrity = this._findIntegrity() || {};
    const expectedIntegrityAlgorithms = Object.keys(expectedIntegrity);
    const shouldValidateIntegrity = (this.hash || this.remote.integrity) && !this.config.updateChecksums;

    if (expectedIntegrityAlgorithms.length === 0 && !shouldValidateIntegrity) {
      const algorithms = this.config.updateChecksums ? ['sha512'] : ['sha1'];
      // for consistency, return sha1 for packages without a remote integrity (eg. github)
      return { integrity: null, algorithms };
    }

    const algorithms = new Set();
    const integrity = {};
    for (var _iterator = expectedIntegrityAlgorithms, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const algorithm = _ref;

      if (isHashAlgorithmSupported(algorithm)) {
        algorithms.add(algorithm);
        integrity[algorithm] = expectedIntegrity[algorithm];
      }
    }

    return { integrity, algorithms: Array.from(algorithms) };
  }
}

exports.default = TarballFetcher;
class LocalTarballFetcher extends TarballFetcher {
  _fetch() {
    return this.fetchFromLocal(this.reference);
  }
}

exports.LocalTarballFetcher = LocalTarballFetcher;


function urlParts(requestUrl) {
  const normalizedUrl = (0, (_normalizeUrl || _load_normalizeUrl()).default)(requestUrl);
  const parsed = url.parse(normalizedUrl);
  const host = parsed.host || '';
  const path = parsed.path || '';
  return { host, path };
}