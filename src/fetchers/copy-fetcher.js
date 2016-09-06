/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import * as fs from '../util/fs.js';

export default class CopyFetcher extends BaseFetcher {
  async _fetch(): Promise<FetchedOverride> {
    await fs.copy(this.reference, this.dest);
    return {
      hash: this.hash || '',
      resolved: null,
    };
  }
}
