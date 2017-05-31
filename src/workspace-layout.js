/* @flow */

import type {WorkspacesManifestMap, Manifest} from './types.js';

export default class WorkspaceLayout {
  constructor(workspaces: WorkspacesManifestMap) {
    this._workspaces = workspaces;
  }

  _workspaces: WorkspacesManifestMap;
  virtualManifestName: string;

  getWorkspaceManifest(key: string): {loc: string, manifest: Manifest} {
    return this._workspaces[key];
  }
}
