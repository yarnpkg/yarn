/* @flow */

import type {Reporter} from '../../reporters/index.js';
import {MessageError} from '../../errors.js';
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

type WarnFunction = (msg: string) => void;

export default function(info: Object, isRoot: boolean, reporter: Reporter, warn: WarnFunction) {
  if (isRoot) {
    for (const key in typos) {
      if (key in info) {
        warn(reporter.lang('manifestPotentialTypo', key, typos[key]));
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
      throw new MessageError(reporter.lang('manifestNameDot'));
    }

    // cannot contain the following characters
    if (!isValidPackageName(name)) {
      throw new MessageError(reporter.lang('manifestNameIllegalChars'));
    }

    // cannot equal node_modules or favicon.ico
    const lower = name.toLowerCase();
    if (lower === 'node_modules' || lower === 'favicon.ico') {
      throw new MessageError(reporter.lang('manifestNameBlacklisted'));
    }
  }

  // validate license
  if (isRoot && !info.private) {
    if (typeof info.license === 'string') {
      const license = info.license.replace(/\*$/g, '');
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
      throw new MessageError(reporter.lang('manifestStringExpected', key));
    }
  }

  cleanDependencies(info, isRoot, reporter, warn);
}

export function cleanDependencies(info: Object, isRoot: boolean, reporter: Reporter, warn: WarnFunction) {
  // get dependency objects
  const depTypes = [];
  for (const type of dependencyKeys) {
    const deps = info[type];
    if (!deps || typeof deps !== 'object') {
      continue;
    }
    depTypes.push([type, deps]);
  }

  // ensure that dependencies don't have ones that can collide
  for (const [type, deps] of depTypes) {
    for (const name in deps) {
      const version = deps[name];

      // check collisions
      for (const [type2, deps2] of depTypes) {
        const version2 = deps2[name];
        if (deps === deps2 || !version2 || version2 === '*') {
          continue;
        }

        if (version !== version2 && isRoot) {
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
