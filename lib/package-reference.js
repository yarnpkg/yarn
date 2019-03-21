'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _misc;

function _load_misc() {
  return _misc = require('./util/misc.js');
}

class PackageReference {
  constructor(request, info, remote) {
    this.resolver = request.resolver;
    this.lockfile = request.lockfile;
    this.requests = [];
    this.config = request.config;
    this.hint = request.hint;

    this.isPlugnplay = false;

    this.registry = remote.registry;
    this.version = info.version;
    this.name = info.name;
    this.uid = info._uid;

    this.remote = remote;

    this.dependencies = [];

    this.permissions = {};
    this.patterns = [];
    this.optional = null;
    this.level = Infinity;
    this.ignore = false;
    this.incompatible = false;
    this.fresh = false;
    this.locations = [];
    this.addRequest(request);
  }

  setFresh(fresh) {
    this.fresh = fresh;
  }

  addLocation(loc) {
    if (this.locations.indexOf(loc) === -1) {
      this.locations.push(loc);
    }
  }

  addRequest(request) {
    this.requests.push(request);

    this.level = Math.min(this.level, request.parentNames.length);
  }

  prune() {
    for (var _iterator = this.patterns, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const selfPattern = _ref;

      // remove ourselves from the resolver
      this.resolver.removePattern(selfPattern);
    }
  }

  addDependencies(deps) {
    this.dependencies = this.dependencies.concat(deps);
  }

  setPermission(key, val) {
    this.permissions[key] = val;
  }

  hasPermission(key) {
    if (key in this.permissions) {
      return this.permissions[key];
    } else {
      return false;
    }
  }

  addPattern(pattern, manifest) {
    this.resolver.addPattern(pattern, manifest);

    this.patterns.push(pattern);

    const shrunk = this.lockfile.getLocked(pattern);
    if (shrunk && shrunk.permissions) {
      for (var _iterator2 = (0, (_misc || _load_misc()).entries)(shrunk.permissions), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const _ref2 = _ref3;
        const key = _ref2[0];
        const perm = _ref2[1];

        this.setPermission(key, perm);
      }
    }
  }

  addOptional(optional) {
    if (this.optional == null) {
      // optional is uninitialised
      this.optional = optional;
    } else if (!optional) {
      // otherwise, ignore all subsequent optional assignments and only accept ones making
      // this not optional
      this.optional = false;
    }
  }
}
exports.default = PackageReference;