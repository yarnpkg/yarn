/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';

export function setFlags(commander: Object) {
  commander.description('Clears registry username and email.');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  await config.registries.yarn.saveHomeConfig({
    username: undefined,
    email: undefined,
  });

  reporter.success(reporter.lang('clearedCredentials'));
}
