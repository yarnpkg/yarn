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

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  await config.registries.kpm.saveHomeConfig({
    username: undefined,
    email: undefined,
  });

  reporter.success('Cleared login credentials');
}
