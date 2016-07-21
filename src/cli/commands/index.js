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

import * as cache from "./cache.js";
export { cache };

import * as ls from "./ls.js";
export { ls };

import * as why from "./why.js";
export { why };

import * as licenses from "./licenses.js";
export { licenses };

import * as uninstall from "./uninstall.js";
export { uninstall };

import * as install from "./install.js";
export { install };

import * as upgrade from "./upgrade.js";
export { upgrade };

import * as check from "./check.js";
export { check };

import buildUseless from "./_useless.js";

export let runScript = buildUseless(
  "Use `fbkpm <script-name>` instead of `fbkpm run-script <script-name>`"
);

export let lockfile = buildUseless(
  "The lockfile command isn't necessary. `fbkpm install` will produce a lockfile."
);

export let dedupe   = buildUseless(
  "The dedupe command isn't necessary. `fbkpm install` will already dedupe."
);

export let prune    = buildUseless(
  "The prune command isn't necessary. `fbkpm install` will now automatically prune extraneous packages."
);
