/* @flow */

import YarnRegistry from './yarn-registry.js';
import NpmRegistry from './npm-registry.js';
import BowerRegistry from './bower-registry.js';

export const registries = {
  npm: NpmRegistry,
  yarn: YarnRegistry,
  bower: BowerRegistry,
};

export const registryNames = Object.keys(registries);

export type RegistryNames = $Keys<typeof registries>;
export type ConfigRegistries = {
  npm: NpmRegistry,
  yarn: YarnRegistry,
  bower: BowerRegistry
};
