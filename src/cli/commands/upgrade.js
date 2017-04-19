/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Add} from './add.js';
import Lockfile from '../../lockfile/wrapper.js';
import PackageRequest from '../../package-request.js';

export function setFlags(commander: Object) {
  // TODO: support some flags that install command has
  commander.usage('upgrade [flags]');
  commander.option('-S, --scope <scope>', 'upgrade packages under the specified scope');
}

export const requireLockfile = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = args.length ? await Lockfile.fromDirectory(config.cwd, reporter) : new Lockfile();
  const {
    dependencies,
    devDependencies,
    optionalDependencies,
    peerDependencies,
  } = await config.readRootManifest() || {};
  const allDependencies = Object.assign({}, peerDependencies, optionalDependencies, devDependencies, dependencies);
  let addArgs = [];

  console.log(allDependencies);

  if (flags.scope) {
    const searchPattern = new RegExp(`^${flags.scope}`);

    for (const dependency of Object.keys(allDependencies)) {
      if (searchPattern.test(dependency)) {
        const remoteSource = allDependencies[dependency];

        if (remoteSource && PackageRequest.getExoticResolver(remoteSource)) {
          addArgs.push(remoteSource);
        }

        addArgs.push(dependency);
      }
    }
  } else {
    addArgs = args.map((dependency) => {
      const remoteSource = allDependencies[dependency];

      console.log(remoteSource);

      if (remoteSource && PackageRequest.getExoticResolver(remoteSource)) {
        return remoteSource;
      }

      return dependency;
    });
  }

  const addFlags = Object.assign({}, flags, {force: true});

  const install = new Add(addArgs, addFlags, config, reporter, lockfile);
  await install.init();
}
