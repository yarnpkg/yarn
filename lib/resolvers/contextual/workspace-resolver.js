'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _packageRequest;

function _load_packageRequest() {
  return _packageRequest = _interopRequireDefault(require('../../package-request.js'));
}

var _baseResolver;

function _load_baseResolver() {
  return _baseResolver = _interopRequireDefault(require('../base-resolver.js'));
}

var _workspaceLayout;

function _load_workspaceLayout() {
  return _workspaceLayout = _interopRequireDefault(require('../../workspace-layout.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

class WorkspaceResolver extends (_baseResolver || _load_baseResolver()).default {
  static isWorkspace(pattern, workspaceLayout) {
    return !!workspaceLayout && !!workspaceLayout.getManifestByPattern(pattern);
  }

  constructor(request, fragment, workspaceLayout) {
    super(request, fragment);
    this.workspaceLayout = workspaceLayout;
  }

  resolve(downloadedManifest) {
    const workspace = this.workspaceLayout.getManifestByPattern(this.request.pattern);
    invariant(workspace, 'expected workspace');
    const manifest = workspace.manifest,
          loc = workspace.loc;

    if (manifest._remote && manifest._remote.registryRemote) {
      return Promise.resolve(manifest); //already downloaded
    }
    const registry = manifest._registry;
    invariant(registry, 'expected reference');
    let hash = '';
    let registryRemote;
    if (downloadedManifest && manifest.version === downloadedManifest.version) {
      registryRemote = downloadedManifest._remote;
      invariant(registryRemote, 'missing remote info');
      hash = registryRemote.hash;
      //override any local changes to manifest
      Object.keys(manifest).forEach(k => k.startsWith('_') || delete manifest[k]);
      Object.assign(manifest, downloadedManifest);
    } else if (manifest._remote && manifest._remote.hash) {
      invariant(workspace.manifest._remote, 'missing remote info');
      registryRemote = workspace.manifest._remote.registryRemote;
      hash = manifest._remote.hash;
    }
    if (registryRemote) {
      registryRemote = (0, (_extends2 || _load_extends()).default)({}, registryRemote);
    }

    manifest._remote = Object.assign(manifest._remote || {}, {
      type: 'workspace',
      registryRemote,
      registry,
      hash,
      reference: loc
    });

    manifest._uid = manifest.version;

    return Promise.resolve(manifest);
  }
}
exports.default = WorkspaceResolver;