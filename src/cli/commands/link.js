/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';
import {getBinFolder as getGlobalBinFolder} from './global';

const invariant = require('invariant');
const cmdShim = require('@zkochan/cmd-shim');
const path = require('path');

export async function getRegistryFolder(config: Config, name: string): Promise<string> {
  if (config.modulesFolder) {
    return config.modulesFolder;
  }

  const src = path.join(config.linkFolder, name);
  const {_registry} = await config.readManifest(src);
  invariant(_registry, 'expected registry');

  const registryFolder = config.registries[_registry].folder;
  return path.join(config.cwd, registryFolder);
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export function setFlags(commander: Object) {
  commander.description('Symlink a package folder during development.');
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (args.length) {
    for (const name of args) {
      const src = path.join(config.linkFolder, name);

      if (await fs.exists(src)) {
        const folder = await getRegistryFolder(config, name);
        const dest = path.join(folder, name);

        await fs.unlink(dest);
        await fs.mkdirp(path.dirname(dest));
        await fs.symlink(src, dest);
        reporter.success(reporter.lang('linkUsing', name));
      } else {
        throw new MessageError(reporter.lang('linkMissing', name));
      }
    }
  } else {
    // add cwd module to the global registry
    const manifest = await config.readRootManifest();
    const name = manifest.name;
    if (!name) {
      throw new MessageError(reporter.lang('unknownPackageName'));
    }

    const linkLoc = path.join(config.linkFolder, name);
    if (await fs.exists(linkLoc)) {
      reporter.warn(reporter.lang('linkCollision', name));
    } else {
      await fs.mkdirp(path.dirname(linkLoc));
      await fs.symlink(config.cwd, linkLoc);

      // If there is a `bin` defined in the package.json,
      // link each bin to the global bin
      if (manifest.bin) {
        const globalBinFolder = await getGlobalBinFolder(config, flags);
        for (const binName in manifest.bin) {
          const binSrc = manifest.bin[binName];
          const binSrcLoc = path.join(linkLoc, binSrc);
          const binDestLoc = path.join(globalBinFolder, binName);
          if (await fs.exists(binDestLoc)) {
            reporter.warn(reporter.lang('binLinkCollision', binName));
          } else {
            if (process.platform === 'win32') {
              await cmdShim(binSrcLoc, binDestLoc);
            } else {
              await fs.symlink(binSrcLoc, binDestLoc);
            }
          }
        }
      }

      reporter.success(reporter.lang('linkRegistered', name));
      reporter.info(reporter.lang('linkRegisteredMessage', name));
    }
  }
}
