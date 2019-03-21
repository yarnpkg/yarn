'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (info, moduleLoc, lockfileFolder) {
  // It won't work if we don't yet know what's the folder we'll use as root. It's not a
  // big deal tho, because it only happens when trying to figure out the root, and we
  // don't need to know the dependencies / devDependencies at this time.
  if (!lockfileFolder) {
    return;
  }

  for (var _iterator = (_constants || _load_constants()).DEPENDENCY_TYPES, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    const dependencyType = _ref;

    const dependencies = info[dependencyType];
    if (!dependencies) {
      continue;
    }

    for (var _iterator2 = Object.keys(dependencies), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref2 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref2 = _i2.value;
      }

      const name = _ref2;

      let value = dependencies[name];

      if (path.isAbsolute(value)) {
        value = (_fileResolver || _load_fileResolver()).FILE_PROTOCOL_PREFIX + value;
      }

      let prefix;
      if (value.startsWith((_fileResolver || _load_fileResolver()).FILE_PROTOCOL_PREFIX)) {
        prefix = (_fileResolver || _load_fileResolver()).FILE_PROTOCOL_PREFIX;
      } else if (value.startsWith((_linkResolver || _load_linkResolver()).LINK_PROTOCOL_PREFIX)) {
        prefix = (_linkResolver || _load_linkResolver()).LINK_PROTOCOL_PREFIX;
      } else {
        continue;
      }
      (0, (_invariant || _load_invariant()).default)(prefix, 'prefix is definitely defined here');

      const unprefixed = value.substr(prefix.length);
      const hasPathPrefix = /^\.(\/|$)/.test(unprefixed);

      const absoluteTarget = path.resolve(lockfileFolder, moduleLoc, unprefixed);
      let relativeTarget = path.relative(lockfileFolder, absoluteTarget) || '.';

      if (hasPathPrefix) {
        // TODO: This logic should be removed during the next major bump
        // If the original value was using the "./" prefix, then we output a similar path.
        // We need to do this because otherwise it would cause problems with already existing
        // lockfile, which would see some of their entries being unrecognized.
        relativeTarget = relativeTarget.replace(/^(?!\.{0,2}\/)/, `./`);
      }

      dependencies[name] = prefix + relativeTarget.replace(/\\/g, '/');
    }
  }
};

var _constants;

function _load_constants() {
  return _constants = require('../../constants.js');
}

var _fileResolver;

function _load_fileResolver() {
  return _fileResolver = require('../../resolvers/exotics/file-resolver.js');
}

var _linkResolver;

function _load_linkResolver() {
  return _linkResolver = require('../../resolvers/exotics/link-resolver.js');
}

var _invariant;

function _load_invariant() {
  return _invariant = _interopRequireDefault(require('invariant'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');