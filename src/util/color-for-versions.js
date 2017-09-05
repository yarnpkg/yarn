/* @flow */
import semver from 'semver';
import {VERSION_COLOR_SCHEME} from '../constants.js';
import type {VersionColor} from '../constants.js';

export default function(from: string, to: string): VersionColor {
  const validFrom = semver.valid(from);
  const validTo = semver.valid(to);
  let versionBump = 'unknown';
  if (validFrom && validTo) {
    versionBump = semver.diff(validFrom, validTo) || 'unchanged';
  }
  return VERSION_COLOR_SCHEME[versionBump];
}
