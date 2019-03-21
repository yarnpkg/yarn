'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.workspace = exports.tarball = exports.git = exports.copy = exports.base = undefined;

var _baseFetcher;

function _load_baseFetcher() {
  return _baseFetcher = _interopRequireDefault(require('./base-fetcher.js'));
}

var _copyFetcher;

function _load_copyFetcher() {
  return _copyFetcher = _interopRequireDefault(require('./copy-fetcher.js'));
}

var _gitFetcher;

function _load_gitFetcher() {
  return _gitFetcher = _interopRequireDefault(require('./git-fetcher.js'));
}

var _tarballFetcher;

function _load_tarballFetcher() {
  return _tarballFetcher = _interopRequireDefault(require('./tarball-fetcher.js'));
}

var _workspaceFetcher;

function _load_workspaceFetcher() {
  return _workspaceFetcher = _interopRequireDefault(require('./workspace-fetcher.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.base = (_baseFetcher || _load_baseFetcher()).default;
exports.copy = (_copyFetcher || _load_copyFetcher()).default;
exports.git = (_gitFetcher || _load_gitFetcher()).default;
exports.tarball = (_tarballFetcher || _load_tarballFetcher()).default;
exports.workspace = (_workspaceFetcher || _load_workspaceFetcher()).default;