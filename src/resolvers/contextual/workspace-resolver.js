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

  resolve(): Promise<Manifest> {
    const workspace = this.workspaceLayout.getManifestByPattern(this.request.pattern);
    invariant(workspace, 'expected workspace');
    const {manifest, loc} = workspace;
    const registry = manifest._registry;
    invariant(registry, 'expected reference');

    manifest._remote = {
      type: 'workspace',
      registry,
      hash: '',
      reference: loc,
    };

    manifest._uid = manifest.version;

    return Promise.resolve(manifest);
  }
}
