/* @flow */

import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import * as fs from '../util/fs.js';

export default class CopyFetcher extends BaseFetcher {
  async _fetch(): Promise<FetchedOverride> {
    await fs.copy(this.reference, this.dest, this.reporter);
    return {
      hash: this.hash || '',
      resolved: null,
    };
  }
}
