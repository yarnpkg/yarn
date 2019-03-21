'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _normalizePattern2;

function _load_normalizePattern() {
  return _normalizePattern2 = require('./util/normalize-pattern.js');
}

const semver = require('semver');

class WorkspaceLayout {
  constructor(workspaces, config) {
    this.workspaces = workspaces;
    this.config = config;
  }

  getWorkspaceManifest(key) {
    return this.workspaces[key];
  }

  getManifestByPattern(pattern) {
    var _normalizePattern = (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(pattern);

    const name = _normalizePattern.name,
          range = _normalizePattern.range;

    const workspace = this.getWorkspaceManifest(name);
    if (!workspace || !semver.satisfies(workspace.manifest.version, range, this.config.looseSemver)) {
      return null;
    }
    return workspace;
  }
}
exports.default = WorkspaceLayout;