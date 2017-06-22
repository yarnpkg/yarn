// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import {makeEnv} from '../../util/execute-lifecycle-script.js';

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const env = await makeEnv(`exec`, config.cwd, config);

  if (args.length < 1) {
    throw new MessageError(reporter.lang('execMissingCommand'));
  }

  const [execName, ...rest] = args;
  await child.spawn(execName, rest, {stdio: 'inherit', env});
}
