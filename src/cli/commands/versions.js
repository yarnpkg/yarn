/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';

import {version as YARN_VERSION} from '../../../package.json';

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  const versions: {[name: string]: string} = {yarn: YARN_VERSION};

  const pkg = await config.maybeReadManifest(config.cwd);
  if (pkg && pkg.name && pkg.version) {
    versions[pkg.name] = pkg.version;
  }

  Object.assign(versions, process.versions);

  reporter.inspect(versions);
}
