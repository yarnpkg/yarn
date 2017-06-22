/* @flow */

import type {Dependency} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import inquirer from 'inquirer';
import PackageRequest from '../../package-request.js';
import {Add} from './add.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';

export const requireLockfile = true;

export function setFlags(commander: Object) {
  commander.usage('upgrade-interactive');
  commander.option('-E, --exact', 'upgrade to most recent release with exact version');
  commander.option('-T, --tilde', 'upgrade to most recent release with patch version');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder);
  const install = new Install(flags, config, reporter, lockfile);
  const deps = await PackageRequest.getOutdatedPackages(lockfile, install, config, reporter);

  if (!deps.length) {
    reporter.success(reporter.lang('allDependenciesUpToDate'));
    return;
  }

  const getNameFromHint = hint => (hint ? `${hint}Dependencies` : 'dependencies');

  const maxLengthArr = {name: 0, current: 0, latest: 0};
  deps.forEach(dep =>
    ['name', 'current', 'latest'].forEach(key => {
      maxLengthArr[key] = Math.max(maxLengthArr[key], dep[key].length);
    }),
  );

  // Depends on maxLengthArr
  const addPadding = dep => key => `${dep[key]}${' '.repeat(maxLengthArr[key] - dep[key].length)}`;

  const colorizeName = ({current, wanted}) => (current === wanted ? reporter.format.yellow : reporter.format.red);

  const colorizeDiff = (from, to) => {
    const parts = to.split('.');
    const fromParts = from.split('.');

    const index = parts.findIndex((part, i) => part !== fromParts[i]);
    const splitIndex = index >= 0 ? index : parts.length;

    const colorized = reporter.format.green(parts.slice(splitIndex).join('.'));
    return parts.slice(0, splitIndex).concat(colorized).join('.');
  };

  const makeRow = dep => {
    const padding = addPadding(dep);
    const name = colorizeName(dep)(padding('name'));
    const current = reporter.format.blue(padding('current'));
    const latest = colorizeDiff(dep.current, padding('latest'));
    const url = reporter.format.cyan(dep.url);
    return `${name}  ${current}  ❯  ${latest}  ${url}`;
  };

  const groupedDeps = deps.reduce((acc, dep) => {
    const {hint, name, latest} = dep;
    const key = getNameFromHint(hint);
    const xs = acc[key] || [];
    acc[key] = xs.concat({
      name: makeRow(dep),
      value: dep,
      short: `${name}@${latest}`,
    });
    return acc;
  }, {});

  const flatten = xs => xs.reduce((ys, y) => ys.concat(Array.isArray(y) ? flatten(y) : y), []);

  const choices = flatten(
    Object.keys(groupedDeps).map(key => [
      new inquirer.Separator(reporter.format.bold.underline.green(key)),
      groupedDeps[key],
      new inquirer.Separator(' '),
    ]),
  );

  try {
    const red = reporter.format.red('<red>');
    const yellow = reporter.format.yellow('<yellow>');
    reporter.info(reporter.lang('legendColorsForUpgradeInteractive', red, yellow));

    const answers: Array<Dependency> = await reporter.prompt('Choose which packages to update.', choices, {
      name: 'packages',
      type: 'checkbox',
      validate: answer => !!answer.length || 'You must choose at least one package.',
    });

    const getName = ({name}) => name;
    const isHint = x => ({hint}) => hint === x;

    await [null, 'dev', 'optional', 'peer'].reduce(async (promise, hint) => {
      // Wait for previous promise to resolve
      await promise;
      // Reset dependency flags
      flags.dev = hint === 'dev';
      flags.peer = hint === 'peer';
      flags.optional = hint === 'optional';

      const deps = answers.filter(isHint(hint)).map(getName);
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
