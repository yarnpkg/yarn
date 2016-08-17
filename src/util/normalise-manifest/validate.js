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

import typos from './typos.js';

const validateLicense = require('validate-npm-package-license');
const isBuiltinModule = require('is-builtin-module');

const strings = [
  'name',
  'version',
];

function isValidName(name: string): boolean {
  return !name.match(/[\/@\s\+%:]/) && encodeURIComponent(name) === name;
}

function isValidScopedName(name: string): boolean {
  if (name[0] !== '@') {
    return false;
  }

  const parts = name.slice(1).split('/');
  return parts.length === 2 && isValidName(parts[0]) && isValidName(parts[1]);
}

export default function(info: Object, warn: (msg: string) => void) {
  for (const key in typos) {
    if (key in info) {
      warn(`Potential typo ${key}, did you mean ${typos[key]}?`);
    }
  }

  const name = info.name;
  if (typeof name === 'string') {
    if (isBuiltinModule(name)) {
      warn(`${name} is also the name of a node core module`);
    }

    // cannot start with a dot
    if (name[0] === '.') {
      throw new TypeError("Name can't start with a dot");
    }

    // cannot contain the following characters
    if (!isValidName(name) && !isValidScopedName(name)) {
      throw new TypeError('Name contains illegal characters');
    }

    // cannot equal node_modules or favicon.ico
    const lower = name.toLowerCase();
    if (lower === 'node_modules' || lower === 'favicon.ico') {
      throw new TypeError('Name is blacklisted');
    }
  }

  // validate license
  if (typeof info.license === 'string') {
    if (!validateLicense(info.license).validForNewPackages) {
      warn('license should be a valid SPDX license expression');
    }
  } else {
    warn('No license field');
  }

  // validate types
  for (const key of strings) {
    const val = info[key];
    if (val && typeof val !== 'string') {
      throw new TypeError(`${key} is not a string`);
    }
  }
}
