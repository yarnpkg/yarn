'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _tarballFetcher;

function _load_tarballFetcher() {
  return _tarballFetcher = _interopRequireDefault(require('../../fetchers/tarball-fetcher.js'));
}

var _exoticResolver;

function _load_exoticResolver() {
  return _exoticResolver = _interopRequireDefault(require('./exotic-resolver.js'));
}

var _gitResolver;

function _load_gitResolver() {
  return _gitResolver = _interopRequireDefault(require('./git-resolver.js'));
}

var _guessName;

function _load_guessName() {
  return _guessName = _interopRequireDefault(require('../../util/guess-name.js'));
}

var _version;

function _load_version() {
  return _version = _interopRequireWildcard(require('../../util/version.js'));
}

var _crypto;

function _load_crypto() {
  return _crypto = _interopRequireWildcard(require('../../util/crypto.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

class TarballResolver extends (_exoticResolver || _load_exoticResolver()).default {
  constructor(request, fragment) {
    super(request, fragment);

    var _versionUtil$explodeH = (_version || _load_version()).explodeHashedUrl(fragment);

    const hash = _versionUtil$explodeH.hash,
          url = _versionUtil$explodeH.url;

    this.hash = hash;
    this.url = url;
  }

  static isVersion(pattern) {
    // we can sometimes match git urls which we don't want
    if ((_gitResolver || _load_gitResolver()).default.isVersion(pattern)) {
      return false;
    }

    // full http url
    if (pattern.startsWith('http://') || pattern.startsWith('https://')) {
      return true;
    }

    // local file reference - ignore patterns with names
    if (pattern.indexOf('@') < 0) {
      if (pattern.endsWith('.tgz') || pattern.endsWith('.tar.gz')) {
        return true;
      }
    }

    return false;
  }

  resolve() {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const shrunk = _this.request.getLocked('tarball');
      if (shrunk) {
        return shrunk;
      }

      const url = _this.url;
      let hash = _this.hash,
          registry = _this.registry;

      let pkgJson;

      // generate temp directory
      const dest = _this.config.getTemp((_crypto || _load_crypto()).hash(url));

      if (yield _this.config.isValidModuleDest(dest)) {
        var _ref = yield _this.config.readPackageMetadata(dest);
        // load from local cache


        pkgJson = _ref.package;
        hash = _ref.hash;
        registry = _ref.registry;
      } else {
        // delete if invalid
        yield (_fs || _load_fs()).unlink(dest);

        const fetcher = new (_tarballFetcher || _load_tarballFetcher()).default(dest, {
          type: 'tarball',
          reference: url,
          registry,
          hash
        }, _this.config);

        // fetch file and get it's hash
        const fetched = yield fetcher.fetch({
          name: (0, (_guessName || _load_guessName()).default)(url),
          version: '0.0.0',
          _registry: 'npm'
        });
        pkgJson = fetched.package;
        hash = fetched.hash;

        registry = pkgJson._registry;
        invariant(registry, 'expected registry');
      }

      // use the commit/tarball hash as the uid as we can't rely on the version as it's not
      // in the registry
      pkgJson._uid = hash;

      // set remote so it can be "fetched"
      pkgJson._remote = {
        type: 'copy',
        resolved: `${url}#${hash}`,
        hash,
        registry,
        reference: dest
      };

      return pkgJson;
    })();
  }
}
exports.default = TarballResolver;