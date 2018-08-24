/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import Lockfile from '../../lockfile';
import {wrapLifecycle, Install} from './install.js';
import {MessageError} from '../../errors.js';

export class Eject extends Install {
  constructor(args: Array<string>, flags: Object, config: Config, reporter: Reporter, lockfile: Lockfile) {
    const workspaceRootIsCwd = config.cwd === config.lockfileFolder;
    const _flags = flags ? {...flags, workspaceRootIsCwd} : {workspaceRootIsCwd};
    config.plugnplayEjected = args;
    super(_flags, config, reporter, lockfile);
  }

  init(): Promise<Array<string>> {
    if (!this.config.plugnplayEnabled) {
      throw new MessageError(this.reporter.lang('ejectPlugnplayDisabled'));
    }
    return Install.prototype.init.call(this);
  }
}

export function hasWrapper(commander: Object): boolean {
  return true;
}

export function setFlags(commander: Object) {
  commander.description(
    'Temporarily copies a package (with an optional @range suffix) outside of the global cache for debugging purposes',
  );
  commander.usage('eject [packages ...] [flags]');
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (!args.length) {
    throw new MessageError(reporter.lang('tooFewArguments', 1));
  }
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);
  await wrapLifecycle(config, flags, async () => {
    const install = new Eject(args, flags, config, reporter, lockfile);
    await install.init();
  });
}
