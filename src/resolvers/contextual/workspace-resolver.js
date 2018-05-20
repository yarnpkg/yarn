/* @flow */

import type {Manifest} from '../../types.js';
import PackageRequest from '../../package-request.js';
import BaseResolver from '../base-resolver.js';
import WorkspaceLayout from '../../workspace-layout.js';

const invariant = require('invariant');

export default class WorkspaceResolver extends BaseResolver {
  static isWorkspace(pattern: string, workspaceLayout: ?WorkspaceLayout): boolean {
    return !!workspaceLayout && !!workspaceLayout.getManifestByPattern(pattern);
  }

  constructor(request: PackageRequest, fragment: string, workspaceLayout: WorkspaceLayout) {
    super(request, fragment);
    this.workspaceLayout = workspaceLayout;
  }

  workspaceLayout: WorkspaceLayout;

  resolve(downloadedManifest: ?Manifest): Promise<Manifest> {
    const workspace = this.workspaceLayout.getManifestByPattern(this.request.pattern);
    invariant(workspace, 'expected workspace');
    const {manifest, loc} = workspace;
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
      registryRemote = {...registryRemote};
    }

    manifest._remote = Object.assign(manifest._remote || {}, {
      type: 'workspace',
      registryRemote,
      registry,
      hash,
      reference: loc,
    });

    manifest._uid = manifest.version;

    return Promise.resolve(manifest);
  }
}
