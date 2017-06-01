/* @flow */

import type Config from './config.js';
import PackageRequest from './package-request.js';
import type {WorkspacesManifestMap, Manifest} from './types.js';

const semver = require('semver');

export default class WorkspaceLayout {
  constructor(workspaces: WorkspacesManifestMap, config: Config) {
    this.workspaces = workspaces;
    this.config = config;
  }

  workspaces: WorkspacesManifestMap;
  config: Config;
  virtualManifestName: string;

  getWorkspaceManifest(key: string): {loc: string, manifest: Manifest} {
    return this.workspaces[key];
  }

  getManifestByPattern(pattern: string): ?{loc: string, manifest: Manifest} {
    const {name, range} = PackageRequest.normalizePattern(pattern);
    const workspace = this.getWorkspaceManifest(name);
    if (!workspace || !semver.satisfies(workspace.manifest.version, range, this.config.looseSemver)) {
      return null;
    }
    return workspace;
  }
}
