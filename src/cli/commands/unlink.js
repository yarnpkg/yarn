/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  if (!args.length) {
    reporter.error('Missing arguments');
    return Promise.reject();
  }
}
