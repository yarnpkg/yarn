/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';
import {getRegistryFolder} from './link.js';

const path = require('path');

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  if (args.length) {
    for (const name of args) {
      const linkLoc = path.join(config.linkFolder, name);
      if (await fs.exists(linkLoc)) {
        await fs.unlink(path.join(await getRegistryFolder(config, name), name));
        reporter.success(reporter.lang('linkUnregistered', name));
      } else {
        throw new MessageError(reporter.lang('linkMissing', name));
      }
    }
  } else {
    // remove from registry
    const manifest = await config.readRootManifest();
    const name = manifest.name;
    if (!name) {
      throw new MessageError(reporter.lang('unknownPackageName'));
    }

    const linkLoc = path.join(config.linkFolder, name);
    if (await fs.exists(linkLoc)) {
      await fs.unlink(linkLoc);
      reporter.success(reporter.lang('linkUnregistered', name));
    } else {
      throw new MessageError(reporter.lang('linkMissing', name));
    }
  }
}
