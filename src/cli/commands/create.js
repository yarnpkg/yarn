// @flow

import {resolve} from 'path';

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import {registryNames} from '../../registries/index.js';
import type {Reporter} from '../../reporters/index.js';
import * as child from '../../util/child.js';
import * as fs from '../../util/fs.js';
import {run as runGlobal} from './global.js';

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const [builderName, ...rest] = args;

  if (!builderName) {
    throw new MessageError(reporter.lang('invalidPackageName'));
  }

  const packageName = builderName.replace(/^(@[^\/]+\/)?/, '$1create-');
  const commandName = packageName.replace(/^@[^\/]+\//, '');

  await runGlobal(config, reporter, {}, ['add', packageName]);

  for (const registry of registryNames) {
    const packagePath = `${config.globalFolder}/${config.registries[registry].folder}/${packageName}`;

    if (!await fs.exists(packagePath)) {
      continue;
    }

    const manifest = await config.tryManifest(packagePath, registry, false);

    if (!manifest || !manifest.bin) {
      continue;
    }

    let binPath;

    if (typeof manifest.bin === 'string') {
      binPath = resolve(packagePath, manifest.bin);
    } else if (typeof manifest.bin === 'object' && manifest.bin[commandName]) {
      binPath = resolve(packagePath, manifest.bin[commandName]);
    } else {
      throw new MessageError(reporter.lang('createInvalidBin', packageName));
    }

    await child.spawn(binPath, rest, {stdio: `inherit`});
    return;
  }

  throw new MessageError(reporter.lang('createMissingPackage'));
}
