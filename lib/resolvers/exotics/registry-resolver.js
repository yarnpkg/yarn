'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _exoticResolver;

function _load_exoticResolver() {
  return _exoticResolver = _interopRequireDefault(require('./exotic-resolver.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class RegistryResolver extends (_exoticResolver || _load_exoticResolver()).default {
  constructor(request, fragment) {
    super(request, fragment);

    const match = fragment.match(/^(\S+):(@?.*?)(@(.*?)|)$/);
    if (match) {
      this.range = match[4] || 'latest';
      this.name = match[2];
    } else {
      throw new (_errors || _load_errors()).MessageError(this.reporter.lang('invalidFragment', fragment));
    }

    // $FlowFixMe
    this.registry = this.constructor.protocol;
  }

  resolve() {
    return this.fork(this.constructor.factory, false, this.name, this.range);
  }
}
exports.default = RegistryResolver;