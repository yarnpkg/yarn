#!/usr/bin/env node

/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

if (require("semver").satisfies(process.versions.node, ">5.0.0")) {
  require("../lib/cli");
} else {
  require("../lib-legacy/cli");
}
