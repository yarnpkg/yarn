/* @flow */

import type Config from './config.js';
import {normalizePattern} from './util/normalize-pattern.js';
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
    const {name, range} = normalizePattern(pattern);
    const workspace = this.getWorkspaceManifest(name);
    if (!workspace) {
      // the dependency specifies a package name that does not exist in this workspace.
      return null;
    }
    if (!semver.validRange(range)) {
      // if the dependency specifies a range that isn't valid semver.
      // It is probably an "exotic" pattern like a github url,
      // or has no range at all as in the case of running the command
      //   yarn workspace @yarnpkg/pkgB add @yarnpkg/pkgA
      // For these, we just match on the package name and allow the workspace package to be used.
      return workspace;
    }
    if (semver.satisfies(workspace.manifest.version, range, this.config.looseSemver)) {
      // the dependency specifies a package name that exists in this workspace
      // and the workspace package's version matches the requested range. Use the workspace package.
      return workspace;
    }
    // the dependency specifies a package name that exists in this workspace,
    // but the workspace package is a version that does not match the requeted range.
    return null;
  }
}
