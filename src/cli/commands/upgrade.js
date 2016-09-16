/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';

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
  const lockfile = new Lockfile();
  const install = new Install(flags, config, reporter, lockfile);
  await install.init();
}
