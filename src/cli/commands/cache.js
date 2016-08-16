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

import type { Reporter } from '../../reporters/index.js';
import type Config from '../../config.js';
import { MessageError } from '../../errors.js';
import * as fs from '../../util/fs.js';

export function setFlags(commander: Object) {
  commander.usage('cache [clear | ls]');
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  // command validation
  let cmd = args[0];
  if (cmd === 'clean') {
    cmd = 'clear';
  }
  if (args.length !== 1 || (cmd !== 'clear' && cmd !== 'ls')) {
    throw new MessageError('Invalid subcommand, use `kpm cache clear` or `kpm cache ls`');
  }

  if (cmd === 'ls') {
    throw new MessageError('TODO');
  }

  let packagesRoot = config.packagesRoot;
  if (cmd === 'clear' && packagesRoot) {
    await fs.unlink(packagesRoot);
    reporter.success(`Cleared ${packagesRoot}`);
  }
}
