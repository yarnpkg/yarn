/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {sortAlpha} from '../../util/misc.js';
import PackageRequest from '../../package-request.js'
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';

const chalk = require('chalk');

export const requireLockfile = true;
export const noArguments = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install(flags, config, reporter, lockfile);

  const items: Array<{
    name: string,
    current: string,
    wanted: string,
    latest: string,
  }> = [];

  const [, patterns] = await install.fetchRequestFromCwd();

  await Promise.all(patterns.map(async (pattern): Promise<void> => {
    const locked = lockfile.getLocked(pattern);
    if (!locked) {
      reporter.error('Outdated lockfile. Please run `$ yarn install` and try again.');
      return Promise.reject();
    }

    let normalised = PackageRequest.normalisePattern(pattern);

    let current = locked.version;
    let name = locked.name;

    let latest = '';
    let wanted = '';

    if (PackageRequest.getExoticResolver(pattern) ||
        PackageRequest.getExoticResolver(normalised.range)) {
      latest = wanted = 'exotic';
    } else {
      ({latest, wanted} = await config.registries[locked.registry].checkOutdated(config, name, normalised.range));
    }

    if (current === latest) {
      return;
    }

    if (current === wanted) {
      name = chalk.yellow(name);
    } else {
      name = chalk.red(name);
    }

    items.push({
      name,
      current,
      wanted,
      latest,
    });
  }));

  if (items.length) {
    let body = items.map((info): Array<string> => {
      return [
        info.name,
        info.current,
        chalk.green(info.wanted),
        chalk.magenta(info.latest),
      ];
    });

    body = body.sort((a, b): number => {
      return sortAlpha(a[0], b[0]);
    });

    reporter.table(['Package', 'Current', 'Wanted', 'Latest'], body);
  }

  return Promise.resolve();
}
