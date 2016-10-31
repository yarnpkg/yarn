/* @flow */

import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';

export default class LinkFetcher extends BaseFetcher {
  _fetch(): Promise<FetchedOverride> {
    // nothing to fetch
    return Promise.resolve({
      hash: this.hash || '',
      resolved: null,
    });
  }
}
