/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';

import {version as yarnVersion} from '../../util/yarn-version.js';

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const versions: {[name: string]: string} = {yarn: yarnVersion};

  const pkg = await config.maybeReadManifest(config.cwd);
  if (pkg && pkg.name && pkg.version) {
    versions[pkg.name] = pkg.version;
  }

  Object.assign(versions, process.versions);

  reporter.inspect(versions);
}
