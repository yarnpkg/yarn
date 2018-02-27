/* @flow */

import type {FetchedMetadata, Manifest} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import * as fs from '../util/fs.js';

export default class LinkFetcher extends BaseFetcher {
  async fetch(defaultManifest: ?Object): Promise<FetchedMetadata> {
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
