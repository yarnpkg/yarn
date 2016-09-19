/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import * as fs from '../../util/fs.js';

export let {run, setFlags} = buildSubCommands('cache', {
  ls(): Promise<void> {
    return Promise.reject(new Error('TODO'));
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
      reporter.success(reporter.lang('clearedCache'));
    }
  },
});
