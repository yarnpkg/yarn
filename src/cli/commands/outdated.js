/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import {sortAlpha} from '../../util/misc.js';
import PackageRequest from '../../package-request.js';
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';

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
      throw new MessageError(reporter.lang('lockfileOutdated'));
    }

    let normalized = PackageRequest.normalizePattern(pattern);

    let current = locked.version;
    let name = locked.name;

    let latest = '';
    let wanted = '';

    if (PackageRequest.getExoticResolver(pattern) ||
        PackageRequest.getExoticResolver(normalized.range)) {
      latest = wanted = 'exotic';
    } else {
      ({latest, wanted} = await config.registries[locked.registry].checkOutdated(config, name, normalized.range));
    }

    if (current === latest) {
      return;
    }

    if (current === wanted) {
      name = reporter.format.yellow(name);
    } else {
      name = reporter.format.red(name);
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
        reporter.format.green(info.wanted),
        reporter.format.magenta(info.latest),
      ];
    });

    body = body.sort((a, b): number => {
      return sortAlpha(a[0], b[0]);
    });

    reporter.table(['Package', 'Current', 'Wanted', 'Latest'], body);
  }

  return Promise.resolve();
}
