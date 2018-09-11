/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import Lockfile from '../../lockfile';
import {wrapLifecycle, Install} from './install.js';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';

const path = require('path');

export function hasWrapper(commander: Object): boolean {
  return true;
}

export function setFlags(commander: Object) {
  commander.description(
    'Temporarily copies a package (with an optional @range suffix) outside of the global cache for debugging purposes',
  );
  commander.usage('unplug [packages ...] [flags]');
  commander.option('--clear', 'Delete the selected packages');
  commander.option('--clear-all', 'Delete all unplugged packages');
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (!config.plugnplayEnabled) {
    throw new MessageError(reporter.lang('unplugDisabled'));
  }
  if (!args.length && flags.clear) {
    throw new MessageError(reporter.lang('tooFewArguments', 1));
  }
  if (args.length && flags.clearAll) {
    throw new MessageError(reporter.lang('noArguments'));
  }

  if (flags.clearAll) {
    await clearAll(config);
  } else if (flags.clear) {
    await clearSome(config, new Set(args));
  } else if (args.length > 0) {
    const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);
    await wrapLifecycle(config, flags, async () => {
      const install = new Install(flags, config, reporter, lockfile);
      install.linker.unplugged = args;
      await install.init();
    });
  }

  const unpluggedPackageFolders = await config.listUnpluggedPackageFolders();

  for (const target of unpluggedPackageFolders.values()) {
    reporter.log(target, {force: true});
  }
}

export async function clearSome(config: Config, filters: Set<string>): Promise<void> {
  const unpluggedPackageFolders = await config.listUnpluggedPackageFolders();
  const removeList = [];

  for (const [unpluggedName, target] of unpluggedPackageFolders.entries()) {
    const {name} = await fs.readJson(path.join(target, 'package.json'));
    const toBeRemoved = filters.has(name);

    if (toBeRemoved) {
      removeList.push(path.join(config.getUnpluggedPath(), unpluggedName));
    }
  }

  if (removeList.length === unpluggedPackageFolders.size) {
    await fs.unlink(config.getUnpluggedPath());
  } else {
    for (const unpluggedPackagePath of removeList) {
      await fs.unlink(unpluggedPackagePath);
    }
  }
}

export async function clearAll(config: Config): Promise<void> {
  await fs.unlink(config.getUnpluggedPath());
}
