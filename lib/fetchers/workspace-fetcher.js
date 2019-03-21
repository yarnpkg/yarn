'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _packageFetcher;

function _load_packageFetcher() {
  return _packageFetcher = require('../package-fetcher.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class WorkspaceFetcher {
  constructor(dest, remote, config) {
    this.config = config;
    this.dest = dest;
    this.registry = remote.registry;
    this.workspaceDir = remote.reference;
    this.registryRemote = remote.registryRemote;
  }

  setupMirrorFromCache() {
    return Promise.resolve();
  }

  fetch() {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const pkg = yield _this.config.readManifest(_this.workspaceDir, _this.registry);

      if (_this.registryRemote) {
        yield _this.fetchRemoteWorkspace(_this.registryRemote, pkg);
      }

      return {
        resolved: null,
        hash: '',
        cached: false,
        dest: _this.dest,
        package: (0, (_extends2 || _load_extends()).default)({}, pkg, {
          _uid: pkg.version
        })
      };
    })();
  }

  fetchRemoteWorkspace(remote, manifest) {
    return (0, (_packageFetcher || _load_packageFetcher()).fetchOneRemote)(remote, manifest.name, manifest.version, this.dest, this.config);
  }
}
exports.default = WorkspaceFetcher;