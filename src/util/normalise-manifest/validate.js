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

let strings = [
  "name",
  "version"
];

export default function (info: Object, warn: (msg: string) => void) {
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
      throw new TypeError("Name can't start with a dot");
    }

    // cannot contain the following characters
    if (name.match(/[\/@\s\+%:]/)) {
      throw new TypeError("Name contains illegal characters");
    }

    // cannot contain any characters that would need to be encoded for use in a url
    if (name !== encodeURIComponent(name)) {
      throw new TypeError("Name cannot contain character that require URL encoding");
    }

    // cannot equal node_modules or favicon.ico
    let lower = name.toLowerCase();
    if (lower === "node_modules" || lower === "favicon.ico") {
      throw new TypeError("Name is blacklisted");
    }
  }

  // validate license
  if (typeof info.license === "string") {
    if (!validateLicense(info.license).validForNewPackages) {
      warn("license should be a valid SPDX license expression");
    }
  } else {
    warn("No license field");
  }

  // validate types
  for (let key of strings) {
    let val = info[key];
    if (val && typeof val !== "string") {
      throw new TypeError(`${key} is not a string`);
    }
  }
}
