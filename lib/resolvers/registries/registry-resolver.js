'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _baseResolver;

function _load_baseResolver() {
  return _baseResolver = _interopRequireDefault(require('../base-resolver.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class RegistryResolver extends (_baseResolver || _load_baseResolver()).default {
  constructor(request, name, range) {
    super(request, `${name}@${range}`);
    this.name = name;
    this.range = range;

    this.registryConfig = request.config.registries[this.constructor.registry].config;
  }

}
exports.default = RegistryResolver;