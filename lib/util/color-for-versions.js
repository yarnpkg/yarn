'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (from, to) {
  const validFrom = (_semver || _load_semver()).default.valid(from);
  const validTo = (_semver || _load_semver()).default.valid(to);
  let versionBump = 'unknown';
  if (validFrom && validTo) {
    versionBump = (0, (_semver2 || _load_semver2()).diffWithUnstable)(validFrom, validTo) || 'unchanged';
  }
  return (_constants || _load_constants()).VERSION_COLOR_SCHEME[versionBump];
};

var _semver;

function _load_semver() {
  return _semver = _interopRequireDefault(require('semver'));
}

var _semver2;

function _load_semver2() {
  return _semver2 = require('./semver.js');
}

var _constants;

function _load_constants() {
  return _constants = require('../constants.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }