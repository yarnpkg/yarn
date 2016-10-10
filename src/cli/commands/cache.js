/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import * as fs from '../../util/fs.js';

const path = require('path');

export const {run, setFlags} = buildSubCommands('cache', {
  async ls(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const files = await fs.readdir(config.packagesRoot);
    const body = [];

    for (const file of files) {
      if (file[0] === '.') {
        continue;
      }

      const loc = path.join(config.packagesRoot, file);
      const {registry, package: manifest, remote} = await config.readPackageMetadata(loc);

      body.push([manifest.name, manifest.version, registry, (remote && remote.resolved) || '']);
    }

    reporter.table(['Name', 'Version', 'Registry', 'Resolved'], body);
  },

  async clean(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const packagesRoot = config.packagesRoot;
    if (packagesRoot) {
      await fs.unlink(packagesRoot);
      await fs.mkdirp(packagesRoot);
      reporter.success(reporter.lang('clearedCache'));
    }
  },
});
