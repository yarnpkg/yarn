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

import BaseFetcher from './_base.js';
import Git from '../util/git.js';

const invariant = require('invariant');

export default class GitFetcher extends BaseFetcher {
  async _fetch(dest: string): Promise<string> {
    const hash = this.hash;
    invariant(hash, 'Commit hash required');

    const git = new Git(this.config, this.reference, hash);
    await git.initRemote();
    await git.clone(dest);
    return hash;
  }
}
