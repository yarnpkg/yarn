/* @flow */

import NpmRegistry from "./npm";
import BowerRegistry from "./bower";

export let registries = {
  npm: NpmRegistry,
  bower: BowerRegistry
};

export type RegistryNames = $Keys<typeof registries>;
