'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _npmResolver;

function _load_npmResolver() {
  return _npmResolver = _interopRequireDefault(require('./npm-resolver.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class YarnResolver extends (_npmResolver || _load_npmResolver()).default {}
exports.default = YarnResolver;