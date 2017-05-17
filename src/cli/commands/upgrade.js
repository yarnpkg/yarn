/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Add} from './add.js';
import Lockfile from '../../lockfile/wrapper.js';
import PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';

export function setFlags(commander: Object) {
  // TODO: support some flags that install command has
  commander.usage('upgrade [flags]');
  commander.option('-S, --scope <scope>', 'upgrade packages under the specified scope');
}

export function hasWrapper(): boolean {
  return true;
}

export const requireLockfile = true;

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const lockfile = args.length ? await Lockfile.fromDirectory(config.cwd, reporter) : new Lockfile();
  const {
    dependencies,
    devDependencies,
    optionalDependencies,
    peerDependencies,
  } = (await config.readRootManifest()) || {};
  const allDependencies = Object.assign({}, peerDependencies, optionalDependencies, devDependencies, dependencies);
  let addArgs = [];

  if (flags.scope) {
    if (!flags.scope.startsWith('@')) {
      flags.scope = '@' + flags.scope;
    }

    if (!flags.scope.endsWith('/')) {
      flags.scope += '/';
    }

    if (/^@[a-zA-Z0-9-][a-zA-Z0-9_.-]*\/$/g.test(flags.scope)) {
      addArgs = Object.keys(allDependencies)
        .filter(dependency => {
          return dependency.startsWith(flags.scope);
        })
        .map(dependency => {
          return getDependency(allDependencies, dependency);
        });
    } else {
      throw new MessageError(reporter.lang('scopeNotValid'));
    }
  } else {
    addArgs = args.map(dependency => {
      return getDependency(allDependencies, dependency);
    });
  }

  const addFlags = Object.assign({}, flags, {force: true});

  const install = new Add(addArgs, addFlags, config, reporter, lockfile);
  await install.init();
}

function getDependency(allDependencies, dependency): string {
  const remoteSource = allDependencies[dependency];

  if (remoteSource && PackageRequest.getExoticResolver(remoteSource)) {
    return remoteSource;
  }

  return dependency;
}
