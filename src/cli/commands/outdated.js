/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import PackageRequest from '../../package-request.js';
import Lockfile from '../../lockfile';
import {Install} from './install.js';
import colorForVersions from '../../util/color-for-versions';
import colorizeDiff from '../../util/colorize-diff.js';
import {MessageError} from '../../errors';

export const requireLockfile = true;

export function setFlags(commander: Object) {
  commander.description('Checks for outdated package dependencies.');
  commander.usage('outdated [packages ...] [flags]');
  commander.option('-M, --main', 'Show only package "dependencies".');
  commander.option('-D, --dev', 'Show only package "devDependencies".');
  commander.option('-O, --optional', 'Show only package "optionalDependencies".');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<number> {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder);
  const install = new Install({...flags, includeWorkspaceDeps: true}, config, reporter, lockfile);
  const {main, dev, optional} = flags;
  let deps = await PackageRequest.getOutdatedPackages(lockfile, install, config, reporter);

  if ((main && dev) || (main && optional) || (dev && optional)) {
    throw new MessageError(reporter.lang('yarnOutdatedMultipleFlags', config.cwd));
  }

  if (args.length) {
    const requested = new Set(args);

    deps = deps.filter(({name}) => requested.has(name));

    if (main || dev || optional) {
      reporter.info(reporter.lang('yarnOutdatedFlagsWithPackage'));
    }
  } else {
    if (main) {
      deps = deps.filter(({hint}) => !hint);
    } else if (dev) {
      deps = deps.filter(({hint}) => hint && hint === 'dev');
    } else if (optional) {
      deps = deps.filter(({hint}) => hint && hint === 'optional');
    }
  }

  const getNameFromHint = hint => (hint ? `${hint}Dependencies` : 'dependencies');
  const colorizeName = ({current, latest, name}) => reporter.format[colorForVersions(current, latest)](name);

  if (deps.length) {
    const usesWorkspaces = !!config.workspaceRootFolder;
    const body = deps.map((info): Array<string> => {
      const row = [
        colorizeName(info),
        info.current,
        colorizeDiff(info.current, info.wanted, reporter),
        reporter.format.cyan(info.latest),
        info.workspaceName || '',
        getNameFromHint(info.hint),
        reporter.format.cyan(info.url),
      ];
      if (!usesWorkspaces) {
        row.splice(4, 1);
      }
      return row;
    });

    const red = reporter.format.red('<red>');
    const yellow = reporter.format.yellow('<yellow>');
    const green = reporter.format.green('<green>');
    reporter.info(reporter.lang('legendColorsForVersionUpdates', red, yellow, green));

    const header = ['Package', 'Current', 'Wanted', 'Latest', 'Workspace', 'Package Type', 'URL'];
    if (!usesWorkspaces) {
      header.splice(4, 1);
    }
    reporter.table(header, body);

    return 1;
  }
  return 0;
}
