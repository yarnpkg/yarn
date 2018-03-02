// @flow

import type Config from '../../config.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import * as fs from '../../util/fs.js';
import {NODE_BIN_PATH, PNP_FILENAME} from '../../constants';

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const pnpPath = `${config.lockfileFolder}/${PNP_FILENAME}`;

  if (await fs.exists(pnpPath)) {
    args = ['-r', pnpPath, ...args];
  }

  try {
    await child.spawn(NODE_BIN_PATH, args, {
      stdio: 'inherit',
      cwd: config.cwd,
    });
  } catch (err) {
    throw err;
  }
}
