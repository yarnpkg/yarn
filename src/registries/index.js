/* @flow */

import NpmRegistry from "./npm.js";
import BowerRegistry from "./bower.js";

export let registries = {
  npm: NpmRegistry,
  bower: BowerRegistry
};

export type RegistryNames = $Keys<typeof registries>;
