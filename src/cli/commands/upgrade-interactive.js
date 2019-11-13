/* @flow */

import type {Dependency} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import inquirer from 'inquirer';
import Lockfile from '../../lockfile';
import {Add} from './add.js';
import {getOutdated, cleanLockfile} from './upgrade.js';
import colorForVersions from '../../util/color-for-versions';
import colorizeDiff from '../../util/colorize-diff.js';
import {Install} from './install.js';

const path = require('path');

export const requireLockfile = true;

export function setFlags(commander: Object) {
  commander.description('Provides an easy way to update outdated packages.');
  commander.usage('upgrade-interactive [flags]');
  commander.option('-S, --scope <scope>', 'upgrade packages under the specified scope');
  commander.option('--latest', 'list the latest version of packages, ignoring version ranges in package.json');
  commander.option('-E, --exact', 'install exact version. Only used when --latest is specified.');
  commander.option(
    '-T, --tilde',
    'install most recent release with the same minor version. Only used when --latest is specified.',
  );
  commander.option(
    '-C, --caret',
    'install most recent release with the same major version. Only used when --latest is specified.',
  );
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const outdatedFieldName = flags.latest ? 'latest' : 'wanted';
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder);

  const deps = await getOutdated(config, reporter, {...flags, includeWorkspaceDeps: true}, lockfile, args);

  if (deps.length === 0) {
    reporter.success(reporter.lang('allDependenciesUpToDate'));
    return;
  }

  // Fail early with runtime compatibility checks so that it doesn't fail after you've made your selections
  const install = new Install(flags, config, reporter, lockfile);
  await install.checkCompatibility();

  const usesWorkspaces = !!config.workspaceRootFolder;

  const maxLengthArr = {
    name: 'name'.length,
    current: 'from'.length,
    range: 'latest'.length,
    [outdatedFieldName]: 'to'.length,
    workspaceName: 'workspace'.length,
  };

  const keysWithDynamicLength = ['name', 'current', outdatedFieldName];

  if (!flags.latest) {
    maxLengthArr.range = 'range'.length;
    keysWithDynamicLength.push('range');
  }

  if (usesWorkspaces) {
    keysWithDynamicLength.push('workspaceName');
  }

  deps.forEach(dep =>
    keysWithDynamicLength.forEach(key => {
      maxLengthArr[key] = Math.max(maxLengthArr[key], dep[key].length);
    }),
  );

  // Depends on maxLengthArr
  const addPadding = dep => key => `${dep[key]}${' '.repeat(maxLengthArr[key] - dep[key].length)}`;
  const headerPadding = (header, key) =>
    `${reporter.format.bold.underline(header)}${' '.repeat(maxLengthArr[key] - header.length)}`;

  const colorizeName = (from, to) => reporter.format[colorForVersions(from, to)];

  const getNameFromHint = hint => (hint ? `${hint}Dependencies` : 'dependencies');

  const makeRow = dep => {
    const padding = addPadding(dep);
    const name = colorizeName(dep.current, dep[outdatedFieldName])(padding('name'));
    const current = reporter.format.blue(padding('current'));
    const latest = colorizeDiff(dep.current, padding(outdatedFieldName), reporter);
    const url = reporter.format.cyan(dep.url);
    const range = reporter.format.blue(flags.latest ? 'latest' : padding('range'));
    if (usesWorkspaces) {
      const workspace = padding('workspaceName');
      return `${name}  ${range}  ${current}  ❯  ${latest}  ${workspace}  ${url}`;
    } else {
      return `${name}  ${range}  ${current}  ❯  ${latest}  ${url}`;
    }
  };

  const makeHeaderRow = () => {
    const name = headerPadding('name', 'name');
    const range = headerPadding('range', 'range');
    const from = headerPadding('from', 'current');
    const to = headerPadding('to', outdatedFieldName);
    const url = reporter.format.bold.underline('url');
    if (usesWorkspaces) {
      const workspace = headerPadding('workspace', 'workspaceName');
      return `  ${name}  ${range}  ${from}     ${to}  ${workspace}  ${url}`;
    } else {
      return `  ${name}  ${range}  ${from}     ${to}  ${url}`;
    }
  };

  const groupedDeps = deps.reduce((acc, dep) => {
    const {hint, name, upgradeTo} = dep;
    const version = dep[outdatedFieldName];
    const key = getNameFromHint(hint);
    const xs = acc[key] || [];
    acc[key] = xs.concat({
      name: makeRow(dep),
      value: dep,
      short: `${name}@${version}`,
      upgradeTo,
    });
    return acc;
  }, {});

  const flatten = xs => xs.reduce((ys, y) => ys.concat(Array.isArray(y) ? flatten(y) : y), []);

  const choices = flatten(
    Object.keys(groupedDeps).map(key => [
      new inquirer.Separator(reporter.format.bold.underline.green(key)),
      new inquirer.Separator(makeHeaderRow()),
      groupedDeps[key],
      new inquirer.Separator(' '),
    ]),
  );

  try {
    const red = reporter.format.red('<red>');
    const yellow = reporter.format.yellow('<yellow>');
    const green = reporter.format.green('<green>');
    reporter.info(reporter.lang('legendColorsForVersionUpdates', red, yellow, green));

    const answers: Array<Dependency> = await reporter.prompt('Choose which packages to update.', choices, {
      name: 'packages',
      type: 'checkbox',
      validate: answer => !!answer.length || 'You must choose at least one package.',
    });

    const getPattern = ({upgradeTo}) => upgradeTo;
    const isHint = x => ({hint}) => hint === x;

    for (const hint of [null, 'dev', 'optional', 'peer']) {
      // Reset dependency flags
      flags.dev = hint === 'dev';
      flags.peer = hint === 'peer';
      flags.optional = hint === 'optional';
      flags.ignoreWorkspaceRootCheck = true;
      flags.includeWorkspaceDeps = false;
      flags.workspaceRootIsCwd = false;
      const deps = answers.filter(isHint(hint));
      if (deps.length) {
        const install = new Install(flags, config, reporter, lockfile);
        const {requests: packagePatterns} = await install.fetchRequestFromCwd();
        const depsByWorkspace = deps.reduce((acc, dep) => {
          const {workspaceLoc} = dep;
          const xs = acc[workspaceLoc] || [];
          acc[workspaceLoc] = xs.concat(dep);
          return acc;
        }, {});
        const cwd = config.cwd;
        for (const loc of Object.keys(depsByWorkspace)) {
          const patterns = depsByWorkspace[loc].map(getPattern);
          cleanLockfile(lockfile, deps, packagePatterns, reporter);
          reporter.info(reporter.lang('updateInstalling', getNameFromHint(hint)));
          if (loc !== '') {
            config.cwd = path.resolve(path.dirname(loc));
          }
          const add = new Add(patterns, flags, config, reporter, lockfile);
          await add.init();
          config.cwd = cwd;
        }
      }
    }
  } catch (e) {
    Promise.reject(e);
  }
}
