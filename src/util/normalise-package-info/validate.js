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

import typos from "./typos.js";

let validateLicense = require("validate-npm-package-license");
let isBuiltinModule = require("is-builtin-module");
let semver          = require("semver");

export default function (info: Object, moduleLoc: string, warn: (msg: string) => void): void {
  for (let key in typos) {
    if (key in info) {
      warn(`Potential typo ${key}, did you mean ${typos[key]}?`);
    }
  }

  let name = info.name;
  if (typeof name === "string") {
    if (isBuiltinModule(name)) {
      warn(`${name} is also the name of a node core module`);
    }

    // cannot start with a dot
    if (name[0] === ".") {
      throw new TypeError;
    }

    // cannot contain the following characters
    if (name.match(/[\/@\s\+%:]/)) {
      throw new TypeError;
    }

    // cannot contain any characters that would need to be encoded for use in a url
    if (name !== encodeURIComponent(name)) {
      throw new TypeError;
    }

    // cannot equal node_modules or favicon.ico
    let lower = name.toLowerCase();
    if (lower === "node_modules" || lower === "favico.ico") {
      throw new TypeError;
    }
  }

  // validate semver version
  if (typeof info.version === "string" && !semver.valid(info.version)) {
    info.version = semver.clean(info.version);
  }

  // validate license
  if (typeof info.license === "string") {
    if (!validateLicense(info.license).validForNewPackages) {
      warn("license should be a valid SPDX license expression");
    }
  } else {
    warn("No license field");
  }
}
