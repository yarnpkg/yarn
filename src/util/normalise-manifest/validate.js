/* @flow */

import type {Reporter} from '../../reporters/index.js';
import {isValidLicense} from './util.js';
import typos from './typos.js';

const isBuiltinModule = require('is-builtin-module');

const strings = [
  'name',
  'version',
];

const dependencyKeys = [
  // npm registry will include optionalDependencies in dependencies and we'll want to dedupe them from the
  // other fields first
  'optionalDependencies',

  // it's seemingly common to include a dependency in dependencies and devDependencies of the same name but
  // different ranges, this can cause a lot of issues with our determinism and the behaviour of npm is
  // currently unspecified.
  'dependencies',

  'devDependencies',
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

      // check collisions
      for (let [type2, deps2] of depTypes) {
        let version2 = deps2[name];
        if (!version2 || version2 === '*') {
          continue;
        }

        if (version !== version2) {
          if (isRoot) {
            // only throw a warning when at the root
            warn(
              reporter.lang('manifestDependencyCollision', type, name, version, type2, version2),
            );
          }
          delete deps2[name];
        }
      }
    }
  }
}
