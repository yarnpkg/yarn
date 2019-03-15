/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {getBinEntries} from './run.js';

const path = require('path');

export function hasWrapper(commander: Object): boolean {
  return false;
}

export function setFlags(commander: Object) {
  commander.description('Displays the location of the yarn bin folder.');
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const binFolder = path.join(config.cwd, config.registryFolders[0], '.bin');
  if (args.length === 0) {
    reporter.log(binFolder, {force: true});
  } else {
    const binEntries = await getBinEntries(config);

    const binName = args[0];
    const binPath = binEntries.get(binName);

    if (binPath) {
      reporter.log(binPath, {force: true});
    } else {
      reporter.error(reporter.lang('packageBinaryNotFound', binName));
    }
  }
}
