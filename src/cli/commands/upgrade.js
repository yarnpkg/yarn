/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Add} from './add.js';
import Lockfile from '../../lockfile/wrapper.js';

export function setFlags(commander: Object) {
  // TODO: support some flags that install command has
  commander.usage('upgrade [flags]');
}

export const requireLockfile = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = args.length ? await Lockfile.fromDirectory(config.cwd, reporter) : new Lockfile();
  const install = new Add(args, flags, config, reporter, lockfile);
  await install.init();
}
