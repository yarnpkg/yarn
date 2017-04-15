/* @flow */

import * as constants from '../../constants.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import Parse from '../../lockfile/parse.js';

const path = require('path');
const fs = require('fs');

export function hasWrapper() {}

export function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const rawLockfile = fs.readFileSync(path.join(config.cwd, constants.LOCKFILE_FILENAME));
  const lockfile = Parse(rawLockfile.toString());
  console.log(lockfile);
  return Promise.resolve();
}
