/* @flow */

import type {Dependency} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import inquirer from 'inquirer';
import PackageRequest from '../../package-request.js';
import {Add} from './add.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';

const basicSemverOperatorRegex = new RegExp('^(\\^|~|>|<=|>=)?[^ |&,]+$');

export const requireLockfile = true;

export function setFlags(commander: Object) {
  commander.usage('upgrade-interactive');
  commander.option('--latest',
    'list the latest version of packages, ignoring version ranges in package.json');
  commander.option('-E, --exact',
    'install exact version. Only used when --latest is specified.');
  commander.option('-T, --tilde',
    'install most recent release with the same minor version. Only used when --latest is specified.');
  commander.option('-C, --caret',
    'install most recent release with the same major version. Only used when --latest is specified.');
}

export function hasWrapper(): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder);
  const install = new Install(flags, config, reporter, lockfile);
  const outdatedFieldName = flags.latest ? 'latest' : 'wanted';
  const deps = (await PackageRequest.getOutdatedPackages(lockfile, install, config, reporter))
    .filter(dep => dep.current != dep[outdatedFieldName]);

  if (!deps.length) {
    reporter.success(reporter.lang('allDependenciesUpToDate'));
    return;
  }

  const getNameFromHint = hint => (hint ? `${hint}Dependencies` : 'dependencies');

  const maxLengthArr = {
    name: 'name'.length,
    current: 'from'.length,
    range: 'range'.length,
    [outdatedFieldName]: 'to'.length,
  };

  deps.forEach(dep =>
    ['name', 'current', 'range', outdatedFieldName].forEach(key => {
      maxLengthArr[key] = Math.max(maxLengthArr[key], dep[key].length);
    }),
  );

  if (flags.latest) {
    maxLengthArr.range = 'latest'.length;
  } else {
    // these flags only have an affect when --latest is used
    flags.tilde = false;
    flags.exact = false;
    flags.caret = false;
  }

  // Depends on maxLengthArr
  const addPadding = dep => key => `${dep[key]}${' '.repeat(maxLengthArr[key] - dep[key].length)}`;
  const headerPadding = (header, key) =>
    `${reporter.format.bold.underline(header)}${' '.repeat(maxLengthArr[key] - header.length)}`;

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
    const latest = colorizeDiff(dep.current, padding(outdatedFieldName));
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

  // this function attempts to determine the range operator on the semver range.
  // this will only handle the simple cases of a semver starting with '^', '~', '>', '>=', '<=', or an exact version.
  // "exotic" semver ranges will not be handled.
  const getRangeOperator = dep => {
    const result = basicSemverOperatorRegex.exec(dep.range);
    return result ? result[1] || '' : '^';
  };

  // Attempt to preserve the range operator from the package.json specified semver range.
  // If an explicit operator was specified using --exact, --tilde, --caret, then that will take precedence.
  const buildPatternToUpgradeTo = dep => {
    const toLatest = flags.latest;
    let rangeOperator;

    if (toLatest && flags.caret) {
      rangeOperator = '^';
    }
    if (toLatest && flags.tilde) {
      rangeOperator = '~';
    }
    if (toLatest && flags.exact) {
      rangeOperator = '';
    }
    rangeOperator = getRangeOperator(dep[outdatedFieldName]);

    return `${dep.name}@${rangeOperator}${dep.range}`;
  };

  const groupedDeps = deps.reduce((acc, dep) => {
    const {hint, name} = dep;
    const version = dep[outdatedFieldName];
    const key = getNameFromHint(hint);
    const xs = acc[key] || [];
    const pattern = buildPatternToUpgradeTo(dep);
    acc[key] = xs.concat({
      name: makeRow(dep),
      value: dep,
      short: `${name}@${version}`,
      pattern,
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
    const answers: Array<Dependency> = await reporter.prompt('Choose which packages to update.', choices, {
      name: 'packages',
      type: 'checkbox',
      validate: answer => !!answer.length || 'You must choose at least one package.',
    });

    const getPattern = ({pattern}) => pattern;
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
