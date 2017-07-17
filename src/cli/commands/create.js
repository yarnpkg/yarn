// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import {run as runGlobal, getBinFolder} from './global.js';

const path = require('path');

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const [builderName, ...rest] = args;

  if (!builderName) {
    throw new MessageError(reporter.lang('invalidPackageName'));
  }

  const packageName = builderName.replace(/^(@[^\/]+\/)?/, '$1create-');
  const commandName = packageName.replace(/^@[^\/]+\//, '');

  await runGlobal(config, reporter, {}, ['add', packageName]);

  const binFolder = await getBinFolder(config, {});
  const command = path.resolve(binFolder, path.basename(commandName));

  await child.spawn(command, [...rest], {stdio: `inherit`, shell: true});
}
