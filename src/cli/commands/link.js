/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
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

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  if (args.length) {
    for (const name of args) {
      const src = path.join(config.linkFolder, name);

      if (await fs.exists(src)) {
        const folder = await getRegistryFolder(config, name);
        const dest = path.join(folder, name);

        await fs.unlink(dest);
        await fs.mkdirp(path.dirname(dest));
        await fs.symlink(src, dest);
        reporter.success(reporter.lang('linkRegistered', name));
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
      throw new MessageError(reporter.lang('linkCollision', name));
    } else {
      await fs.mkdirp(path.dirname(linkLoc));
      await fs.symlink(config.cwd, linkLoc);
      reporter.success(reporter.lang('linkRegistered', name));
      reporter.info(reporter.lang('linkInstallMessage', name));
    }
  }
}
