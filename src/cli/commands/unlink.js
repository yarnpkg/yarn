/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';

const path = require('path');

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const names = args;
  if (!names.length) {
    const manifest = await config.readRootManifest();
    const name = manifest.name;
    if (name) {
      names.push(name);
    } else {
      throw new MessageError(reporter.lang('unknownPackageName'));
    }
  }

  for (const name of names) {
    const linkLoc = path.join(config.linkFolder, name);
    if (await fs.exists(linkLoc)) {
      await fs.unlink(linkLoc);
      reporter.success(reporter.lang('linkUnregistered', name));
    } else {
      throw new MessageError(reporter.lang('linkMissing', name));
    }
  }
}
