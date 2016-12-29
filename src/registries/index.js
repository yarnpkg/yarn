/* @flow */

import YarnRegistry from './yarn-registry.js';
import NpmRegistry from './npm-registry.js';

export const registries = {
  npm: NpmRegistry,
  yarn: YarnRegistry,
};

export const registryNames = Object.keys(registries);

export type RegistryNames = $Keys<typeof registries>;
export type ConfigRegistries = {
  npm: NpmRegistry,
  yarn: YarnRegistry,
};
