/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import KpmRegistry from './KpmRegistry.js';
import NpmRegistry from './NpmRegistry.js';
import BowerRegistry from './BowerRegistry.js';

export let registries = {
  npm: NpmRegistry,
  kpm: KpmRegistry,
  bower: BowerRegistry,
};

export let registryNames = Object.keys(registries);

export type RegistryNames = $Keys<typeof registries>;
