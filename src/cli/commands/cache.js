/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import * as fs from '../../util/fs.js';
import {METADATA_FILENAME} from '../../constants';

const path = require('path');
const micromatch = require('micromatch');

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] !== 'dir';
}

async function list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  async function readCacheMetadata(
    parentDir = config.cacheFolder,
    metadataFile = METADATA_FILENAME,
  ): Promise<Array<Array<string>>> {
    const folders = await fs.readdir(parentDir);
    const packagesMetadata = [];

    for (const folder of folders) {
      if (folder[0] === '.') {
        continue;
      }

      const loc = path.join(config.cacheFolder, parentDir.replace(config.cacheFolder, ''), folder);
      // Check if this is a scoped package
      if (!await fs.exists(path.join(loc, metadataFile))) {
        // If so, recurrently read scoped packages metadata
        packagesMetadata.push(...(await readCacheMetadata(loc)));
      } else {
        const {registry, package: manifest, remote} = await config.readPackageMetadata(loc);
        if (flags.pattern && !micromatch.contains(manifest.name, flags.pattern)) {
          continue;
        }
        packagesMetadata.push([manifest.name, manifest.version, registry, (remote && remote.resolved) || '']);
      }
    }

    return packagesMetadata;
  }

  const body = await readCacheMetadata();

  reporter.table(['Name', 'Version', 'Registry', 'Resolved'], body);
}

const {run, setFlags: _setFlags, examples} = buildSubCommands('cache', {
  async ls(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    reporter.warn(`\`yarn cache ls\` is deprecated. Please use \`yarn cache list\`.`);
    await list(config, reporter, flags, args);
  },

  async list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await list(config, reporter, flags, args);
  },

  dir(config: Config, reporter: Reporter) {
    reporter.log(config.cacheFolder, {force: true});
  },

  async clean(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    async function getPackageCachefolders(
      packageName,
      parentDir = config.cacheFolder,
      metadataFile = METADATA_FILENAME,
    ): Promise<Array<string>> {
      const folders = await fs.readdir(parentDir);
      const packageFolders = [];

      for (const folder of folders) {
        if (folder[0] === '.') {
          continue;
        }

        const loc = path.join(config.cacheFolder, parentDir.replace(config.cacheFolder, ''), folder);
        // Check if this is a scoped package
        if (!await fs.exists(path.join(loc, metadataFile))) {
          // If so, recurrently read scoped packages metadata
          packageFolders.push(...(await getPackageCachefolders(packageName, loc)));
        } else {
          const {package: manifest} = await config.readPackageMetadata(loc);
          if (packageName === manifest.name) {
            packageFolders.push(loc);
          }
        }
      }

      return packageFolders;
    }

    if (config.cacheFolders && config.cacheFolder) {
      const activity = reporter.activity();

      if (args.length > 0) {
        // Clear named package from cache
        const folders = await getPackageCachefolders(args[0]);

        if (folders.length === 0) {
          activity.end();
          reporter.warn(reporter.lang('couldntClearPackageFromCache', args[0]));
          return;
        }

        for (const folder of folders) {
          await fs.unlink(folder);
        }
        activity.end();
        reporter.success(reporter.lang('clearedPackageFromCache', args[0]));
      } else {
        // Clear all cache
        for (const cacheFolder of config.cacheFolders) {
          await fs.unlink(cacheFolder);
        }
        await fs.mkdirp(config.cacheFolder);
        activity.end();
        reporter.success(reporter.lang('clearedCache'));
      }
    }
  },
});

export {run, examples};

export function setFlags(commander: Object) {
  _setFlags(commander);
  commander.option('--pattern [pattern]', 'filter cached packages by pattern');
}
