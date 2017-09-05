/* @flow */

import type {PackageRemote, FetchedMetadata} from '../types.js';
import type Config from '../config.js';
import type {RegistryNames} from '../registries/index.js';

export default class WorkspaceFetcher {
  constructor(dest: string, remote: PackageRemote, config: Config) {
    this.config = config;
    this.dest = dest;
    this.registry = remote.registry;
    this.workspaceDir = remote.reference;
  }

  config: Config;
  dest: string;
  registry: RegistryNames;
  workspaceDir: string;

  setupMirrorFromCache(): Promise<?string> {
    return Promise.resolve();
  }

  async fetch(): Promise<FetchedMetadata> {
    const pkg = await this.config.readManifest(this.workspaceDir, this.registry);

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
}
