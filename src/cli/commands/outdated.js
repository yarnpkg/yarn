/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import PackageRequest from '../../package-request.js';
import Lockfile from '../../lockfile';
import {Install} from './install.js';
import {colorForVersions, symbolForVersions} from '../../util/info-for-versions';
import colorizeDiff from '../../util/colorize-diff.js';

export const requireLockfile = true;

export function setFlags(commander: Object) {
  commander.description('Checks for outdated package dependencies.');
  commander.usage('outdated [packages ...]');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<number> {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder);
  const install = new Install({...flags, includeWorkspaceDeps: true}, config, reporter, lockfile);
  let deps = await PackageRequest.getOutdatedPackages(lockfile, install, config, reporter);

  if (args.length) {
    const requested = new Set(args);

    deps = deps.filter(({name}) => requested.has(name));
  }

  const getNameFromHint = hint => (hint ? `${hint}Dependencies` : 'dependencies');
  const colorizeName = ({current, latest, name}) => reporter.format[colorForVersions(current, latest)](name);

  if (deps.length) {
    const usesWorkspaces = !!config.workspaceRootFolder;
    const body = deps.map((info): Array<string> => {
      const row = [
        symbolForVersions(info.current, info.latest),
        colorizeName(info),
        info.current,
        colorizeDiff(info.current, info.wanted, reporter),
        reporter.format.cyan(info.latest),
        info.workspaceName || '',
        getNameFromHint(info.hint),
        reporter.format.cyan(info.url),
      ];
      if (!usesWorkspaces) {
        row.splice(5, 1);
      }
      return row;
    });

    const major = 'M ' + reporter.format.red('package-name');
    const minor = 'm ' + reporter.format.yellow('package-name');
    const patch = 'p ' + reporter.format.green('package-name');
    reporter.info(reporter.lang('legendColorsForVersionUpdates', major, minor, patch));

    const header = [' ', 'Package', 'Current', 'Wanted', 'Latest', 'Workspace', 'Package Type', 'URL'];
    if (!usesWorkspaces) {
      header.splice(5, 1);
    }
    reporter.table(header, body);

    return 1;
  }
  return 0;
}
