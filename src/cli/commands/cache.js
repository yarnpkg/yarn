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

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import * as fs from '../../util/fs.js';

export let {run, setFlags} = buildSubCommands('cache', {
  async ls(): Promise<void> {
    throw new Error('TODO');
  },

  async clear(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const packagesRoot = config.packagesRoot;
    if (packagesRoot) {
      await fs.unlink(packagesRoot);
      reporter.success(`Cleared ${packagesRoot}`);
    }
  },
});
