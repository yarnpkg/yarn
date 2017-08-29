/* @flow */

import type {Dependency} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import inquirer from 'inquirer';
import Lockfile from '../../lockfile';
import {Add} from './add.js';
import {getOutdated} from './upgrade.js';
import colorForVersions from '../../util/color-for-versions';
import colorizeDiff from '../../util/colorize-diff.js';

export const requireLockfile = true;

export function setFlags(commander: Object) {
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

  const deps = await getOutdated(config, reporter, flags, lockfile, args);

  if (deps.length === 0) {
    reporter.success(reporter.lang('allDependenciesUpToDate'));
    return;
  }

  const maxLengthArr = {
    name: 'name'.length,
    current: 'from'.length,
    range: 'latest'.length,
    [outdatedFieldName]: 'to'.length,
  };

  const keysWithDynamicLength = ['name', 'current', outdatedFieldName];

  if (!flags.latest) {
    maxLengthArr.range = 'range'.length;
    keysWithDynamicLength.push('range');
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
    return `${name}  ${range}  ${current}  ❯  ${latest}  ${url}`;
  };

  const makeHeaderRow = () => {
    const name = headerPadding('name', 'name');
    const range = headerPadding('range', 'range');
    const from = headerPadding('from', 'current');
    const to = headerPadding('to', outdatedFieldName);
    const url = reporter.format.bold.underline('url');
    return `  ${name}  ${range}  ${from}     ${to}  ${url}`;
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
    reporter.info(reporter.lang('legendColorsForUpgradeInteractive', red, yellow, green));

    const answers: Array<Dependency> = await reporter.prompt('Choose which packages to update.', choices, {
      name: 'packages',
      type: 'checkbox',
      validate: answer => !!answer.length || 'You must choose at least one package.',
    });

    const getPattern = ({upgradeTo}) => upgradeTo;
    const isHint = x => ({hint}) => hint === x;

    await [null, 'dev', 'optional', 'peer'].reduce(async (promise, hint) => {
      // Wait for previous promise to resolve
      await promise;
      // Reset dependency flags
      flags.dev = hint === 'dev';
      flags.peer = hint === 'peer';
      flags.optional = hint === 'optional';

      const deps = answers.filter(isHint(hint)).map(getPattern);
      if (deps.length) {
        reporter.info(reporter.lang('updateInstalling', getNameFromHint(hint)));
        const add = new Add(deps, flags, config, reporter, lockfile);
        return add.init();
      }
      return Promise.resolve();
    }, Promise.resolve());
  } catch (e) {
    Promise.reject(e);
  }
}
