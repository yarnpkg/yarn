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

import type {Reporter} from '../../reporters/index.js';
import {isValidLicense} from './util.js';
import typos from './typos.js';

const isBuiltinModule = require('is-builtin-module');

const strings = [
  'name',
  'version',
];

const dependencyKeys = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
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

export function isValidPackageName(name: string): boolean {
  return isValidName(name) || isValidScopedName(name);
}

export default function(info: Object, isRoot: boolean, reporter: Reporter, warn: (msg: string) => void) {
  if (isRoot) {
    for (const key in typos) {
      if (key in info) {
        warn(reporter.lang('manifestPotentialType', key, typos[key]));
      }
    }
  }

  // validate name
  const {name} = info;
  if (typeof name === 'string') {
    if (isRoot && isBuiltinModule(name)) {
      warn(reporter.lang('manifestBuiltinModule', name));
    }

    // cannot start with a dot
    if (name[0] === '.') {
      throw new TypeError(reporter.lang('manifestNameDot'));
    }

    // cannot contain the following characters
    if (!isValidPackageName(name)) {
      throw new TypeError(reporter.lang('manifestNameIllegalChars'));
    }

    // cannot equal node_modules or favicon.ico
    const lower = name.toLowerCase();
    if (lower === 'node_modules' || lower === 'favicon.ico') {
      throw new TypeError(reporter.lang('manifestNameBlacklisted'));
    }
  }

  // validate license
  if (isRoot && !info.private) {
    if (typeof info.license === 'string') {
      let license = info.license.replace(/\*$/g, '');
      if (!isValidLicense(license)) {
        warn(reporter.lang('manifestLicenseInvalid'));
      }
    } else {
      warn(reporter.lang('manifestLicenseNone'));
    }
  }

  // validate strings
  for (const key of strings) {
    const val = info[key];
    if (val && typeof val !== 'string') {
      throw new TypeError(reporter.lang('manifestStringExpected', key));
    }
  }

  // get dependency objects
  let depTypes = [];
  for (let type of dependencyKeys) {
    let deps = info[type];
    if (!deps || typeof deps !== 'object') {
      continue;
    }
    depTypes.push([type, deps]);
  }

  // check root dependencies for builtin module names
  if (isRoot) {
    for (let [type, deps] of depTypes) {
      for (let name in deps) {
        if (isBuiltinModule(name)) {
          warn(reporter.lang('manifestDependencyBuiltin', name, type));
        }
      }
    }
  }

  // ensure that dependencies don't have ones that can collide
  for (let [type, deps] of depTypes) {
    for (let name in deps) {
      let version = deps[name];
      if (version === '*') {
        continue;
      }

      // check collisions
      for (let [type2, deps2] of depTypes) {
        let version2 = deps2[name];
        if (!version2 || version2 === '*') {
          continue;
        }

        if (version !== version2) {
          throw new TypeError(
            reporter.lang('manifestDependencyCollision', type, name, version, type2, version2),
          );
        }
      }
    }
  }
}
