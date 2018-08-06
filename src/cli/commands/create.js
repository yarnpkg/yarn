// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import {run as runGlobal, getBinFolder} from './global.js';

const path = require('path');

export function setFlags(commander: Object) {
  commander.description('Creates new projects from any create-* starter kits.');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

const coerceName = (name = '') => (name === '' ? 'create' : `create-${name}`);
const coerceScope = (scope = '') => (scope === '@' ? '' : scope);
const coerceFullName = (scope, name) => [coerceScope(scope), coerceName(name)].filter(Boolean).join('/');

/**
 * # Tests
 *
 * ## basic
 * parseBuilderName('name').packageName === 'create-name'
 * parseBuilderName('@scope/name').packageName === '@scope/create-name'
 *
 * ## not adding "-" if name is empty
 * parseBuilderName('@scope/').packageName === '@scope/create'
 * parseBuilderName('@scope').packageName === '@scope/create'
 *
 * ## edge cases
 * parseBuilderName('@/name').packageName === 'create-name'
 * parseBuilderName('/name').packageName === 'create-name'
 * parseBuilderName('@/').packageName === 'create'
 */
const parseBuilderName = str => {
  const parts = str.split('/');
  if (parts.length === 1 && !str.includes('@')) {
    return {
      packageName: coerceName(str),
      packageDir: '',
      commandName: coerceName(str),
    };
  }
  return {
    packageName: coerceFullName(parts[0], parts[1]),
    packageDir: coerceScope(parts[0]),
    commandName: coerceName(parts[1]),
  };
};

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const [builderName, ...rest] = args;

  if (!builderName) {
    throw new MessageError(reporter.lang('invalidPackageName'));
  }

  const {packageName, packageDir, commandName} = parseBuilderName(builderName);
  await runGlobal(config, reporter, {}, ['add', packageName]);

  const binFolder = await getBinFolder(config, {});
  const command = path.resolve(binFolder, packageDir, path.basename(commandName));

  await child.spawn(command, rest, {stdio: `inherit`, shell: true});
}
