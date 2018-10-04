/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import PackageRequest from '../../package-request.js';
import Lockfile from '../../lockfile';
import {Install} from './install.js';
import colorForVersions from '../../util/color-for-versions';
import colorizeDiff from '../../util/colorize-diff.js';
import {categorizeDependencies} from '../../util/categorizeDependencies';

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
    const categorizedDependecies = categorizeDependencies(deps);

    const createRows = function(dependencies, category): Array<Array<string>> {
      // Prevent creating a heading row for empty categories.
      if (dependencies.length === 0) {
        return [];
      }

      // Start with a heading row.
      const rows = [[category, '', '', '', '', '']];
      dependencies.map((info): void => {
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
        rows.push(row);
      });

      // End with an empty row for spacing.
      rows.push(['', '', '', '', '', '']);
      return rows;
    };

    const majorRows = createRows(categorizedDependecies.major, 'Major Update backward-incompatible updates');
    const minorRows = createRows(categorizedDependecies.minor, 'Minor Update backward-compatible features');
    const patchRows = createRows(categorizedDependecies.patch, 'Patch Update backward-compatible bug fixes');
    const otherRows = createRows(categorizedDependecies.other, 'Other');

    const body = majorRows.concat(minorRows, patchRows, otherRows);

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
