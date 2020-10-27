/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';
import {getBinFolder as getGlobalBinFolder} from './global';

const invariant = require('invariant');
const cmdShim = require('@zkochan/cmd-shim');
const path = require('path');

// Create a link (in the current package's node_modules directory) to a global link-registered package
async function makeLinkToRegisteredPackage(
  registeredPackageName: string,
  config: Config,
  reporter: Reporter,
) {
  const src = path.join(config.linkFolder, registeredPackageName);

  if (await fs.exists(src)) {
    const folder = await getRegistryFolder(config, registeredPackageName);
    const dest = path.join(folder, registeredPackageName);

    await fs.unlink(dest);
    await fs.mkdirp(path.dirname(dest));
    await fs.symlink(src, dest);
    reporter.success(reporter.lang("linkUsing", registeredPackageName));
  } else {
    throw new MessageError(reporter.lang("linkMissing", registeredPackageName));
  }
}

// Add cwd module to the global registry of link-registered packages
async function linkRegisterThisPackage(config: Config, reporter: Reporter, flags: Object) {
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
            await cmdShim(binSrcLoc, binDestLoc, {createPwshFile: false});
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

async function getLinksToRegisteredPackages(config: Config, reporter: Reporter, packageNames: string[]): Promise<string[]> {
  const linkedPackages = [];
  for (const name of packageNames) {
    const folder = await getRegistryFolder(config, name);
    try {
      const stat = await fs.stat(path.join(folder, name));
      if (stat.isDirectory()) {
        linkedPackages.push(name);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
  return linkedPackages;
}

async function getRegisteredPackages(config: Config, reporter: Reporter): Promise<string[]> {
  let files = await fs.readdir(config.linkFolder);
  
  let packages = []
  for (const file of files) {
    if ((await fs.stat(path.join(config.linkFolder, file))).isDirectory()) {
      packages.push(path.basename(file))
    }
  }

  return packages
}

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
  commander.option(
    '--list',
    `List currently linked packages and all global package candidates`
  );
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (flags.list) {
    const registeredPackages = await getRegisteredPackages(config, reporter)
    const linkedPackages = await getLinksToRegisteredPackages(config, reporter, registeredPackages)

    if (linkedPackages.length > 0) {
      reporter.info(`Packages currently linked (use 'yarn unlink [package]' to unlink):`)
      reporter.list('list', linkedPackages);
    } else {
      reporter.info(`No packages currently linked (use 'yarn link [package]' to link)`)
    }

    reporter.info(`Packages registered and available to 'yarn link [package]':`)
    reporter.list('list', registeredPackages);
  } else if (args.length) {
    for (const packageName of args) {
      await makeLinkToRegisteredPackage(packageName, config, reporter)
    }
  } else {
    await linkRegisterThisPackage(config, reporter, flags)
  }
}
