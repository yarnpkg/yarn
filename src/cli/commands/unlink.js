/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';

let path = require('path');

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  let names = args;
  if (!names.length) {
    let manifest = await config.readRootManifest();
    let name = manifest.name;
    if (name) {
      names.push(name);
    } else {
      throw new MessageError(reporter.lang('unknownPackageName'));
    }
  }

  for (let name of names) {
    let linkLoc = path.join(config.linkFolder, name);
    if (await fs.exists(linkLoc)) {
      await fs.unlink(linkLoc);
      reporter.success(reporter.lang('linkUnregistered', name));
    } else {
      throw new MessageError(reporter.lang('linkMissing', name));
    }
  }
}
