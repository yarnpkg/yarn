/* @flow */

import KpmRegistry from './kpm-registry.js';
import NpmRegistry from './npm-registry.js';
import BowerRegistry from './bower-registry.js';

export let registries = {
  npm: NpmRegistry,
  kpm: KpmRegistry,
  bower: BowerRegistry,
};

export let registryNames = Object.keys(registries);

export type RegistryNames = $Keys<typeof registries>;
