/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Add} from './add.js';
import Lockfile from '../../lockfile/wrapper.js';
import PackageRequest from '../../package-request.js';

export function setFlags(commander: Object) {
  // TODO: support some flags that install command has
  commander.usage('upgrade [flags]');
}

export const requireLockfile = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = args.length ? await Lockfile.fromDirectory(config.cwd, reporter) : new Lockfile();
  const manifest = await config.readRootManifest() || {};
  const dependencies = manifest.dependencies || {};

  const addArgs = args.map((dependency) => {
    const remoteSource = dependencies[dependency];

    if (remoteSource && PackageRequest.getExoticResolver(remoteSource)) {
      return remoteSource;
    }

    return dependency;
  });

  const addFlags = Object.assign({}, flags, {force: true});

  const install = new Add(addArgs, addFlags, config, reporter, lockfile);
  await install.init();
}
