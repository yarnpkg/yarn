'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _baseResolver;

function _load_baseResolver() {
  return _baseResolver = _interopRequireDefault(require('../base-resolver.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ExoticResolver extends (_baseResolver || _load_baseResolver()).default {

  static isVersion(pattern) {
    const proto = this.protocol;
    if (proto) {
      return pattern.startsWith(`${proto}:`);
    } else {
      throw new Error('No protocol specified');
    }
  }
}
exports.default = ExoticResolver;