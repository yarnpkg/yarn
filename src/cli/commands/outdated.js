/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import PackageRequest from '../../package-request.js';
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';

export const requireLockfile = true;

export function setFlags(commander: Object) {
  commander.usage('outdated [packages ...]');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<number> {
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install(flags, config, reporter, lockfile);
  let deps = await PackageRequest.getOutdatedPackages(lockfile, install, config, reporter);

  if (args.length) {
    const requested = new Set(args);

    deps = deps.filter(({name}) => requested.has(name));
  }

  const getNameFromHint = hint => (hint ? `${hint}Dependencies` : 'dependencies');
  const getColorFromVersion = ({current, wanted, name}) =>
    current === wanted ? reporter.format.yellow(name) : reporter.format.red(name);

  if (deps.length) {
    const body = deps.map((info): Array<string> => {
      return [
        getColorFromVersion(info),
        info.current,
        reporter.format.green(info.wanted),
        reporter.format.magenta(info.latest),
        getNameFromHint(info.hint),
        reporter.format.cyan(info.url),
      ];
    });

    reporter.table(['Package', 'Current', 'Wanted', 'Latest', 'Package Type', 'URL'], body);
    return 1;
  }
  return 0;
}
