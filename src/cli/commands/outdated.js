/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import PackageRequest from '../../package-request.js';
import Lockfile from '../../lockfile';
import {Install} from './install.js';
import colorForVersions from '../../util/color-for-versions';
import colorizeDiff from '../../util/colorize-diff.js';

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
  const colorizeName = ({current, wanted, name}) => reporter.format[colorForVersions(current, wanted)](name);

  if (deps.length) {
    const body = deps.map((info): Array<string> => {
      return [
        colorizeName(info),
        info.current,
        colorizeDiff(info.current, info.wanted, reporter),
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
