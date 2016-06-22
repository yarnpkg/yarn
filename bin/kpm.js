#!/usr/bin/env node

/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

/* eslint-disable no-var */

var semver = require("semver");
var ver = process.versions.node;

if (semver.satisfies(ver, ">=5.0.0")) {
  module.exports = require("./lib/cli/index.js");
} else if (semver.satisfies(ver, ">=4.0.0")) {
  module.exports = require("./lib-legacy/cli/index.js");
} else {
  throw new Error("Node version " + ver + " is not supported");
}
