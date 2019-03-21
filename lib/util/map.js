'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = nullify;
function nullify(obj = {}) {
  if (Array.isArray(obj)) {
    for (var _iterator = obj, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const item = _ref;

      nullify(item);
    }
  } else if (obj !== null && typeof obj === 'object' || typeof obj === 'function') {
    Object.setPrototypeOf(obj, null);

    // for..in can only be applied to 'object', not 'function'
    if (typeof obj === 'object') {
      for (const key in obj) {
        nullify(obj[key]);
      }
    }
  }

  return obj;
}