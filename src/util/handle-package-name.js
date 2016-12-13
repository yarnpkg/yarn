/* @flow */

import NpmRegistry from '../registries/npm-registry.js';
import type Config from '../config.js';

export default async function handlePackageName(
  packageName: string,
  config: Config,
): Promise<string> {
  packageName = packageName || '.';

  // Handle the case when we are referencing a local package.
  if (packageName === '.') {
    packageName = (await config.readRootManifest()).name;
  }

  return Promise.resolve(NpmRegistry.escapeName(packageName));
}
