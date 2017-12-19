/* @flow */

import type {PackageRemote, FetchedMetadata, Manifest} from '../types.js';
import type Config from '../config.js';
import type {RegistryNames} from '../registries/index.js';
import * as fs from '../util/fs.js';

export default class LinkFetcher {
  constructor(dest: string, remote: PackageRemote, config: Config) {
    this.config = config;
    this.dest = dest;
    this.reference = remote.reference;
    this.registry = remote.registry;
  }

  config: Config;
  dest: string;
  registry: RegistryNames;
  reference: string;

  setupMirrorFromCache(): Promise<?string> {
    return Promise.resolve();
  }

  async fetch(): Promise<FetchedMetadata> {
    const sourceExists = await fs.exists(this.reference);
    let pkg: Manifest = {_uid: '', name: '', version: '0.0.0'};

    if (sourceExists) {
      try {
        pkg = await this.config.readManifest(this.reference, this.registry);
      } catch (ex) {
        // pkg will remain the fake Manifest
      }
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
}
