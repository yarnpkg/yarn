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
import {getToken} from './login.js';

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  reporter.step(1, 3, 'Logging in');
  let {token, revoke} = await getToken(config, reporter);

  reporter.step(2, 3, 'Setting tag');
  token;

  reporter.step(3, 3, 'Revoking token');
  await revoke();
}
