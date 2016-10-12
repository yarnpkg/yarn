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
    const files = await fs.readdir(config.cacheFolder);
    const body = [];

    for (const file of files) {
      if (file[0] === '.') {
        continue;
      }

      const loc = path.join(config.cacheFolder, file);
      const {registry, package: manifest, remote} = await config.readPackageMetadata(loc);

      body.push([manifest.name, manifest.version, registry, (remote && remote.resolved) || '']);
    }

    reporter.table(['Name', 'Version', 'Registry', 'Resolved'], body);
  },

  dir(config: Config) {
    console.log(config.packagesRoot);
  },

  async clean(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const cacheFolder = config.cacheFolder;
    if (cacheFolder) {
      await fs.unlink(cacheFolder);
      await fs.mkdirp(cacheFolder);
      reporter.success(reporter.lang('clearedCache'));
    }
  },
});
