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
import {Install} from './install.js';
import Lockfile from '../../lockfile/index.js';

export function setFlags(commander: Object) {
  // TODO: support some flags that install command has
  commander;
}

export const noArguments = true;
export const requireLockfile = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = new Lockfile(null, false);
  const install = new Install('update', flags, args, config, reporter, lockfile);
  return install.init();
}
