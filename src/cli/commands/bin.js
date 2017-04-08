/* @flow */

import BaseCommand from './_base.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import RegistryYarn from '../../resolvers/registries/yarn-resolver.js';

const path = require('path');

export default class BinCommand extends BaseCommand {
  hasWrapper(): boolean {
    return false;
  }

  run(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const binFolder = path.join(
      config.cwd,
      config.registries[RegistryYarn.registry].folder,
      '.bin',
    );
    console.log(binFolder);
    return Promise.resolve();
  }
}
