'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.registryNames = exports.registries = undefined;

var _yarnRegistry;

function _load_yarnRegistry() {
  return _yarnRegistry = _interopRequireDefault(require('./yarn-registry.js'));
}

var _npmRegistry;

function _load_npmRegistry() {
  return _npmRegistry = _interopRequireDefault(require('./npm-registry.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const registries = exports.registries = {
  npm: (_npmRegistry || _load_npmRegistry()).default,
  yarn: (_yarnRegistry || _load_yarnRegistry()).default
};

const registryNames = exports.registryNames = Object.keys(registries);