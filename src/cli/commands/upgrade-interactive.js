/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import inquirer from 'inquirer';
import repeat from 'repeating';
import {MessageError} from '../../errors.js';
import PackageRequest from '../../package-request.js';
import {Add} from './add.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';

const tty = require('tty');
const semver = require('semver');

export const requireLockfile = true;

export function setFlags(commander: Object) {
  // TODO: support some flags that install command has
  commander.usage('update');
}

type Dependency = {
  name: string,
  current: string,
  wanted: string,
  latest: string,
  hint: ?string
};

type InquirerResponses<K, T> = {[key: K]: Array<T>};

// Prompt user with Inquirer
async function prompt(choices): Promise<Array<Dependency>> {
  let pageSize;
  if (process.stdout instanceof tty.WriteStream) {
    pageSize = process.stdout.rows - 2;
  }
  const answers: InquirerResponses<'packages', Dependency> = await inquirer.prompt([{
    name: 'packages',
    type: 'checkbox',
    message: 'Choose which packages to update.',
    choices,
    pageSize,
    validate: (answer) => !!answer.length || 'You must choose at least one package.',
  }]);
  return answers.packages;
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install(flags, config, reporter, lockfile);
  const [deps] = await install.fetchRequestFromCwd();

  const allDeps = await Promise.all(deps.map(async ({pattern, hint}): Promise<Dependency> => {
    const locked = lockfile.getLocked(pattern);
    if (!locked) {
      throw new MessageError(reporter.lang('lockfileOutdated'));
    }

    const {name, version: current} = locked;
    let latest = '';
    let wanted = '';

    const normalized = PackageRequest.normalizePattern(pattern);

    if (PackageRequest.getExoticResolver(pattern) ||
        PackageRequest.getExoticResolver(normalized.range)) {
      latest = wanted = 'exotic';
    } else {
      ({latest, wanted} = await config.registries[locked.registry].checkOutdated(config, name, normalized.range));
    }

    return ({name, current, wanted, latest, hint});
  }));

  const isDepOld = ({latest, current}) => latest !== 'exotic' && semver.lt(current, latest);
  const isDepExpected = ({current, wanted}) => current === wanted;
  const orderByExpected = (depA, depB) => isDepExpected(depA) && !isDepExpected(depB) ? 1 : -1;

  const outdatedDeps = allDeps.filter(isDepOld).sort(orderByExpected);

  if (!outdatedDeps.length) {
    reporter.success(reporter.lang('allDependenciesUpToDate'));
    return;
  }

  const getNameFromHint = (hint) => hint ? `${hint}Dependencies` : 'dependencies';

  const maxLengthArr = {name: 0, current: 0, latest: 0};
  outdatedDeps.forEach((dep) =>
    ['name', 'current', 'latest'].forEach((key) => {
      maxLengthArr[key] = Math.max(maxLengthArr[key], dep[key].length);
    }),
  );

  // Depends on maxLengthArr
  const addPadding = (dep) => (key) =>
    `${dep[key]}${repeat(' ', maxLengthArr[key] - dep[key].length)}`;

  const colorizeName = ({current, wanted}) =>
    (current === wanted) ? reporter.format.yellow : reporter.format.red;

  const makeRow = (dep) => {
    const padding = addPadding(dep);
    const name = colorizeName(dep)(padding('name'));
    const current = reporter.format.blue(padding('current'));
    const latest = reporter.format.green(padding('latest'));
    return `${name}  ${current}  ❯  ${latest}`;
  };

  const groupedDeps = outdatedDeps.reduce((acc, dep) => {
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

  const flatten = (xs) => xs.reduce(
      (ys, y) => ys.concat(Array.isArray(y) ? flatten(y) : y), [],
  );

  const choices = Object.keys(groupedDeps).map((key) => [
    new inquirer.Separator(reporter.format.bold.underline.green(key)),
    groupedDeps[key],
    new inquirer.Separator(' '),
  ]);

  const answers = await prompt(flatten(choices));

  const getName = ({name}) => name;
  const isHint = (x) => ({hint}) => hint === x;

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
      return await add.init();
    }
    return Promise.resolve();
  }, Promise.resolve());
}
