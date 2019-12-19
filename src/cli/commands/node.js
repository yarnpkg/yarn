// @flow

import type Config from '../../config.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import * as fs from '../../util/fs.js';
import {NODE_BIN_PATH, PNP_FILENAME} from '../../constants';

export function setFlags(commander: Object) {
  commander.description(
    'Runs Node with the same version that the one used by Yarn itself, and by default from the project root',
  );
  commander.usage('node [--into PATH] [... args]');
  commander.option('--into <path>', 'Sets the cwd to the specified location');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const pnpPath = `${config.lockfileFolder}/${PNP_FILENAME}`;

  let nodeOptions = process.env.NODE_OPTIONS || '';
  if (await fs.exists(pnpPath)) {
    // As of node 12+, NODE_OPTIONS does support quoting its arguments
    // If the user has a space in its $PATH, we quote the path and hope the user uses node 12+
    // it will fail if not but it would have thrown either way without quoting...
    nodeOptions = `--require ${quotePathIfNeeded(pnpPath)} ${nodeOptions}`;
  }

  try {
    await child.spawn(NODE_BIN_PATH, args, {
      stdio: 'inherit',
      cwd: flags.into || config.cwd,
      env: {...process.env, NODE_OPTIONS: nodeOptions},
    });
  } catch (err) {
    throw err;
  }
}

function quotePathIfNeeded(p: string): string {
  return /\s/.test(p) ? JSON.stringify(p) : p;
}
