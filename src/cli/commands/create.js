// @flow

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import {makeEnv} from '../../util/execute-lifecycle-script';
import * as fs from '../../util/fs.js';
import {run as runGlobal, getBinFolder} from './global.js';

const path = require('path');

export function setFlags(commander: Object) {
  commander.description('Creates new projects from any create-* starter kits.');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export function parsePackageName(str: string): Object {
  if (str.charAt(0) === '/') {
    throw new Error(`Name should not start with "/", got "${str}"`);
  }
  if (str.charAt(0) === '.') {
    throw new Error(`Name should not start with ".", got "${str}"`);
  }
  const parts = str.split('/');
  const isScoped = str.charAt(0) === '@';
  if (isScoped && parts[0] === '@') {
    throw new Error(`Scope should not be empty, got "${str}"`);
  }
  const scope = isScoped ? parts[0] : '';
  const name = parts[isScoped ? 1 : 0] || '';
  const path = parts.slice(isScoped ? 2 : 1).join('/');
  const fullName = [scope, name].filter(Boolean).join('/');
  const full = [scope, name, path].filter(Boolean).join('/');

  return {fullName, name, scope, path, full};
}

export function coerceCreatePackageName(str: string): Object {
  const pkgNameObj = parsePackageName(str);
  const coercedName = pkgNameObj.name !== '' ? `create-${pkgNameObj.name}` : `create`;
  const coercedPkgNameObj = {
    ...pkgNameObj,
    name: coercedName,
    fullName: [pkgNameObj.scope, coercedName].filter(Boolean).join('/'),
    full: [pkgNameObj.scope, coercedName, pkgNameObj.path].filter(Boolean).join('/'),
  };
  return coercedPkgNameObj;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const [builderName, ...rest] = args;

  if (!builderName) {
    throw new MessageError(reporter.lang('invalidPackageName'));
  }

  const {fullName: packageName, name: commandName} = coerceCreatePackageName(builderName);

  const linkLoc = path.join(config.linkFolder, commandName);
  if (await fs.exists(linkLoc)) {
    reporter.info(reporter.lang('linkUsing', packageName));
  } else {
    await runGlobal(config, reporter, {}, ['add', packageName]);
  }

  const binFolder = await getBinFolder(config, {});
  const command = path.resolve(binFolder, commandName);
  const env = await makeEnv('create', config.cwd, config);

  await child.spawn(command, rest, {stdio: `inherit`, shell: true, env});
}
