'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.stringify = exports.parse = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _parse;

function _load_parse() {
  return _parse = require('./parse');
}

Object.defineProperty(exports, 'parse', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_parse || _load_parse()).default;
  }
});

var _stringify;

function _load_stringify() {
  return _stringify = require('./stringify');
}

Object.defineProperty(exports, 'stringify', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_stringify || _load_stringify()).default;
  }
});
exports.implodeEntry = implodeEntry;
exports.explodeEntry = explodeEntry;

var _misc;

function _load_misc() {
  return _misc = require('../util/misc.js');
}

var _normalizePattern;

function _load_normalizePattern() {
  return _normalizePattern = require('../util/normalize-pattern.js');
}

var _parse2;

function _load_parse2() {
  return _parse2 = _interopRequireDefault(require('./parse.js'));
}

var _constants;

function _load_constants() {
  return _constants = require('../constants.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../util/fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const path = require('path');
const ssri = require('ssri');

function getName(pattern) {
  return (0, (_normalizePattern || _load_normalizePattern()).normalizePattern)(pattern).name;
}

function blankObjectUndefined(obj) {
  return obj && Object.keys(obj).length ? obj : undefined;
}

function keyForRemote(remote) {
  return remote.resolved || (remote.reference && remote.hash ? `${remote.reference}#${remote.hash}` : null);
}

function serializeIntegrity(integrity) {
  // We need this because `Integrity.toString()` does not use sorting to ensure a stable string output
  // See https://git.io/vx2Hy
  return integrity.toString().split(' ').sort().join(' ');
}

function implodeEntry(pattern, obj) {
  const inferredName = getName(pattern);
  const integrity = obj.integrity ? serializeIntegrity(obj.integrity) : '';
  const imploded = {
    name: inferredName === obj.name ? undefined : obj.name,
    version: obj.version,
    uid: obj.uid === obj.version ? undefined : obj.uid,
    resolved: obj.resolved,
    registry: obj.registry === 'npm' ? undefined : obj.registry,
    dependencies: blankObjectUndefined(obj.dependencies),
    optionalDependencies: blankObjectUndefined(obj.optionalDependencies),
    permissions: blankObjectUndefined(obj.permissions),
    prebuiltVariants: blankObjectUndefined(obj.prebuiltVariants)
  };
  if (integrity) {
    imploded.integrity = integrity;
  }
  return imploded;
}

function explodeEntry(pattern, obj) {
  obj.optionalDependencies = obj.optionalDependencies || {};
  obj.dependencies = obj.dependencies || {};
  obj.uid = obj.uid || obj.version;
  obj.permissions = obj.permissions || {};
  obj.registry = obj.registry || 'npm';
  obj.name = obj.name || getName(pattern);
  const integrity = obj.integrity;
  if (integrity && integrity.isIntegrity) {
    obj.integrity = ssri.parse(integrity);
  }
  return obj;
}

class Lockfile {
  constructor({ cache, source, parseResultType } = {}) {
    this.source = source || '';
    this.cache = cache;
    this.parseResultType = parseResultType;
  }

  // source string if the `cache` was parsed


  // if true, we're parsing an old yarn file and need to update integrity fields
  hasEntriesExistWithoutIntegrity() {
    if (!this.cache) {
      return false;
    }

    for (const key in this.cache) {
      // $FlowFixMe - `this.cache` is clearly defined at this point
      if (!/^.*@(file:|http)/.test(key) && this.cache[key] && !this.cache[key].integrity) {
        return true;
      }
    }

    return false;
  }

  static fromDirectory(dir, reporter) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // read the manifest in this directory
      const lockfileLoc = path.join(dir, (_constants || _load_constants()).LOCKFILE_FILENAME);

      let lockfile;
      let rawLockfile = '';
      let parseResult;

      if (yield (_fs || _load_fs()).exists(lockfileLoc)) {
        rawLockfile = yield (_fs || _load_fs()).readFile(lockfileLoc);
        parseResult = (0, (_parse2 || _load_parse2()).default)(rawLockfile, lockfileLoc);

        if (reporter) {
          if (parseResult.type === 'merge') {
            reporter.info(reporter.lang('lockfileMerged'));
          } else if (parseResult.type === 'conflict') {
            reporter.warn(reporter.lang('lockfileConflict'));
          }
        }

        lockfile = parseResult.object;
      } else if (reporter) {
        reporter.info(reporter.lang('noLockfileFound'));
      }

      return new Lockfile({ cache: lockfile, source: rawLockfile, parseResultType: parseResult && parseResult.type });
    })();
  }

  getLocked(pattern) {
    const cache = this.cache;
    if (!cache) {
      return undefined;
    }

    const shrunk = pattern in cache && cache[pattern];

    if (typeof shrunk === 'string') {
      return this.getLocked(shrunk);
    } else if (shrunk) {
      explodeEntry(pattern, shrunk);
      return shrunk;
    }

    return undefined;
  }

  removePattern(pattern) {
    const cache = this.cache;
    if (!cache) {
      return;
    }
    delete cache[pattern];
  }

  getLockfile(patterns) {
    const lockfile = {};
    const seen = new Map();

    // order by name so that lockfile manifest is assigned to the first dependency with this manifest
    // the others that have the same remoteKey will just refer to the first
    // ordering allows for consistency in lockfile when it is serialized
    const sortedPatternsKeys = Object.keys(patterns).sort((_misc || _load_misc()).sortAlpha);

    for (var _iterator = sortedPatternsKeys, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
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

      const pkg = patterns[pattern];
      const remote = pkg._remote,
            ref = pkg._reference;

      invariant(ref, 'Package is missing a reference');
      invariant(remote, 'Package is missing a remote');

      const remoteKey = keyForRemote(remote);
      const seenPattern = remoteKey && seen.get(remoteKey);
      if (seenPattern) {
        // no point in duplicating it
        lockfile[pattern] = seenPattern;

        // if we're relying on our name being inferred and two of the patterns have
        // different inferred names then we need to set it
        if (!seenPattern.name && getName(pattern) !== pkg.name) {
          seenPattern.name = pkg.name;
        }
        continue;
      }
      const obj = implodeEntry(pattern, {
        name: pkg.name,
        version: pkg.version,
        uid: pkg._uid,
        resolved: remote.resolved,
        integrity: remote.integrity,
        registry: remote.registry,
        dependencies: pkg.dependencies,
        peerDependencies: pkg.peerDependencies,
        optionalDependencies: pkg.optionalDependencies,
        permissions: ref.permissions,
        prebuiltVariants: pkg.prebuiltVariants
      });

      lockfile[pattern] = obj;

      if (remoteKey) {
        seen.set(remoteKey, obj);
      }
    }

    return lockfile;
  }
}
exports.default = Lockfile;