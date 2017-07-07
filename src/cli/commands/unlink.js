/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';
import {getRegistryFolder} from './link.js';
import {getBinFolder as getGlobalBinFolder} from './global';

const path = require('path');

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (args.length) {
    for (const name of args) {
      const linkLoc = path.join(config.linkFolder, name);
      if (await fs.exists(linkLoc)) {
        await fs.unlink(path.join(await getRegistryFolder(config, name), name));
        reporter.success(reporter.lang('linkDisusing', name));
        reporter.info(reporter.lang('linkDisusingMessage', name));
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
      // If there is a `bin` defined in the package.json,
      // link each bin to the global bin
      if (manifest.bin) {
        const globalBinFolder = getGlobalBinFolder(config, flags);
        for (const binName in manifest.bin) {
          const binDestLoc = path.join(globalBinFolder, binName);
          if (await fs.exists(binDestLoc)) {
            await fs.unlink(binDestLoc);
          }
        }
      }

      await fs.unlink(linkLoc);

      reporter.success(reporter.lang('linkUnregistered', name));
      reporter.info(reporter.lang('linkUnregisteredMessage', name));
    } else {
      throw new MessageError(reporter.lang('linkMissing', name));
    }
  }
}
