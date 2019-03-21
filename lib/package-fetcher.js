'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fetchOneRemote = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let fetchCache = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (dest, fetcher, config) {
    var _ref2 = yield config.readPackageMetadata(dest);

    const hash = _ref2.hash,
          pkg = _ref2.package;

    yield fetcher.setupMirrorFromCache();
    return {
      package: pkg,
      hash,
      dest,
      cached: true
    };
  });

  return function fetchCache(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
})();

let fetchOneRemote = exports.fetchOneRemote = (() => {
  var _ref3 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (remote, name, version, dest, config) {
    // Mock metadata for symlinked dependencies
    if (remote.type === 'link') {
      const mockPkg = { _uid: '', name: '', version: '0.0.0' };
      return Promise.resolve({ resolved: null, hash: '', dest, package: mockPkg, cached: false });
    }

    const Fetcher = (_index || _load_index())[remote.type];
    if (!Fetcher) {
      throw new (_errors || _load_errors()).MessageError(config.reporter.lang('unknownFetcherFor', remote.type));
    }

    const fetcher = new Fetcher(dest, remote, config);
    if (yield config.isValidModuleDest(dest)) {
      return fetchCache(dest, fetcher, config);
    }

    // remove as the module may be invalid
    yield (_fs || _load_fs()).unlink(dest);

    try {
      return yield fetcher.fetch({
        name,
        version
      });
    } catch (err) {
      try {
        yield (_fs || _load_fs()).unlink(dest);
      } catch (err2) {
        // what do?
      }
      throw err;
    }
  });

  return function fetchOneRemote(_x4, _x5, _x6, _x7, _x8) {
    return _ref3.apply(this, arguments);
  };
})();

let maybeFetchOne = (() => {
  var _ref4 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (ref, config) {
    try {
      return yield fetchOne(ref, config);
    } catch (err) {
      if (ref.optional) {
        config.reporter.error(err.message);
        return null;
      } else {
        throw err;
      }
    }
  });

  return function maybeFetchOne(_x9, _x10) {
    return _ref4.apply(this, arguments);
  };
})();

exports.fetch = fetch;

var _errors;

function _load_errors() {
  return _errors = require('./errors.js');
}

var _index;

function _load_index() {
  return _index = _interopRequireWildcard(require('./fetchers/index.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./util/fs.js'));
}

var _promise;

function _load_promise() {
  return _promise = _interopRequireWildcard(require('./util/promise.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function fetchOne(ref, config) {
  const dest = config.generateModuleCachePath(ref);

  return fetchOneRemote(ref.remote, ref.name, ref.version, dest, config);
}

function fetch(pkgs, config) {
  const pkgsPerDest = new Map();
  pkgs = pkgs.filter(pkg => {
    const ref = pkg._reference;
    if (!ref) {
      return false;
    }
    const dest = config.generateModuleCachePath(ref);
    const otherPkg = pkgsPerDest.get(dest);
    if (otherPkg) {
      config.reporter.warn(config.reporter.lang('multiplePackagesCantUnpackInSameDestination', ref.patterns, dest, otherPkg.patterns));
      return false;
    }
    pkgsPerDest.set(dest, ref);
    return true;
  });
  const tick = config.reporter.progress(pkgs.length);

  return (_promise || _load_promise()).queue(pkgs, (() => {
    var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (pkg) {
      const ref = pkg._reference;
      if (!ref) {
        return pkg;
      }

      const res = yield maybeFetchOne(ref, config);
      let newPkg;

      if (res) {
        newPkg = res.package;

        // update with new remote
        // but only if there was a hash previously as the tarball fetcher does not provide a hash.
        if (ref.remote.hash) {
          // if the checksum was updated, also update resolved and cache
          if (ref.remote.hash !== res.hash && config.updateChecksums) {
            const oldHash = ref.remote.hash;
            if (ref.remote.resolved) {
              ref.remote.resolved = ref.remote.resolved.replace(oldHash, res.hash);
            }
            ref.config.cache = Object.keys(ref.config.cache).reduce(function (cache, entry) {
              const entryWithNewHash = entry.replace(oldHash, res.hash);
              cache[entryWithNewHash] = ref.config.cache[entry];
              return cache;
            }, {});
          }
          ref.remote.hash = res.hash || ref.remote.hash;
        }
      }

      if (tick) {
        tick();
      }

      if (newPkg) {
        newPkg._reference = ref;
        newPkg._remote = ref.remote;
        newPkg.name = pkg.name;
        newPkg.fresh = pkg.fresh;
        return newPkg;
      }

      return pkg;
    });

    return function (_x11) {
      return _ref5.apply(this, arguments);
    };
  })(), config.networkConcurrency);
}