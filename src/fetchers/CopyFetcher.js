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

import BaseFetcher from './BaseFetcher.js';
import * as fs from '../util/fs.js';

export default class CopyFetcher extends BaseFetcher {
  async _fetch(dest: string): Promise<string> {
    await fs.copy(this.reference, dest);
    return this.hash || '';
  }
}
