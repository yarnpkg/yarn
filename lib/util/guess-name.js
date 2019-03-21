'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = guessName;

var _url;

function _load_url() {
  return _url = _interopRequireDefault(require('url'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function cleanup(name) {
  name = name.replace(/-\d+\.\d+\.\d+/, '');
  return name.replace(/\.git$|\.zip$|\.tar\.gz$|\.tar\.bz2$/, '');
}

function guessNameFallback(source) {
  // If cannot parse as url, just return cleaned up last part
  const parts = source.split('/');
  return cleanup(parts[parts.length - 1]);
}

function guessName(source) {
  try {
    const parsed = (_url || _load_url()).default.parse(source);

    if (!parsed.pathname) {
      return guessNameFallback(source);
    }

    const parts = parsed.pathname.split('/');

    // Priority goes to part that ends with .git
    for (var _iterator = parts, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const part = _ref;

      if (part.match(/\.git$/)) {
        return cleanup(part);
      }
    }

    // Most likely a directory
    if (parsed.host == null) {
      return cleanup(parts[parts.length - 1]);
    }

    // A site like github or gitlab
    if (parts.length > 2) {
      return cleanup(parts[2]);
    }

    // Privately hosted package?
    if (parts.length > 1) {
      return cleanup(parts[1]);
    }

    return guessNameFallback(source);
  } catch (e) {
    return guessNameFallback(source);
  }
}