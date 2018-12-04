/* @flow */

import type {PackageRemote, FetchedMetadata, Manifest} from '../types.js';
import type Config from '../config.js';
import type {RegistryNames} from '../registries/index.js';
import {fetchOneRemote} from '../package-fetcher.js';

export default class WorkspaceFetcher {
  constructor(dest: string, remote: PackageRemote, config: Config) {
    this.config = config;
    this.dest = dest;
    this.registry = remote.registry;
    this.workspaceDir = remote.reference;
    this.registryRemote = remote.registryRemote;
  }

  config: Config;
  dest: string;
  registry: RegistryNames;
  workspaceDir: string;
  registryRemote: ?PackageRemote;

  setupMirrorFromCache(): Promise<?string> {
    return Promise.resolve();
  }

  async fetch(): Promise<FetchedMetadata> {
    const pkg = await this.config.readManifest(this.workspaceDir, this.registry);

    if (this.registryRemote) {
      await this.fetchRemoteWorkspace(this.registryRemote, pkg);
    }

    return {
      resolved: null,
      hash: '',
      cached: false,
      dest: this.dest,
      package: {
        ...pkg,
        _uid: pkg.version,
      },
    };
  }

  fetchRemoteWorkspace(remote: PackageRemote, manifest: Manifest): Promise<FetchedMetadata> {
    return fetchOneRemote(remote, manifest.name, manifest.version, this.dest, this.config);
  }
}
