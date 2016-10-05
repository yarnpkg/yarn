/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';

export const noArguments = true;

const path = require('path');

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  // add cwd module to the global registry
  const manifest = await config.readRootManifest();
  const name = manifest.name;
  if (!name) {
    throw new MessageError(reporter.lang('unknownPackageName'));
  }

  const linkLoc = path.join(config.linkFolder, name);
  if (await fs.exists(linkLoc)) {
    throw new MessageError(reporter.lang('linkCollision', name));
  } else {
    await fs.symlink(config.cwd, linkLoc);
    reporter.success(reporter.lang('linkRegistered', name));
    reporter.info(reporter.lang('linkInstallMessage'));
  }
}
