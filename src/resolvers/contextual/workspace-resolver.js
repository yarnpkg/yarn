/* @flow */

import type Config from '../../config.js';
import type {Manifest} from '../../types.js';
import PackageRequest from '../../package-request.js';
import BaseResolver from '../base-resolver.js';
import WorkspaceLayout from '../../workspace-layout.js';

const invariant = require('invariant');
const semver = require('semver');

export default class WorkspaceResolver extends BaseResolver {
  static isWorkspace(pattern: string, config: Config, workspaceLayout: ?WorkspaceLayout): boolean {
    if (!workspaceLayout) {
      return false;
    }
    const {name, range} = PackageRequest.normalizePattern(pattern);
    const workspace = workspaceLayout.getWorkspaceManifest(name);
    if (!workspace) {
      return false;
    }
    return semver.satisfies(workspace.manifest.version, range, config.looseSemver);
  }

  constructor(request: PackageRequest, fragment: string, workspaceLayout: WorkspaceLayout) {
    super(request, fragment);
    this.workspaceLayout = workspaceLayout;
  }

  workspaceLayout: WorkspaceLayout;

  resolve(): Promise<Manifest> {
    const {name, range} = PackageRequest.normalizePattern(this.request.pattern);
    const workspace = this.workspaceLayout.getWorkspaceManifest(name);
    invariant(workspace, 'expected workspace');
    invariant(
      semver.satisfies(workspace.manifest.version, range, this.config.looseSemver),
      'expected workspace to match',
    );

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
