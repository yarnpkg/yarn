/* @flow */
import semver from 'semver';
import {diffWithUnstable} from './semver.js';
import {VERSION_COLOR_SCHEME} from '../constants.js';
import type {VersionColor} from '../constants.js';

export default function colorForVersions(from: string, to: string): VersionColor {
  const validFrom = semver.valid(from);
  const validTo = semver.valid(to);
  let versionBump = 'unknown';
  if (validFrom && validTo) {
    versionBump = diffWithUnstable(validFrom, validTo) || 'unchanged';
  }
  return VERSION_COLOR_SCHEME[versionBump];
}

export function colorAndEmojiForVersions(from: string, to: string): [VersionColor, ?string] {
  const color: VersionColor = colorForVersions(from, to);
  let emoji = '';
  switch (color) {
    case 'red':
      emoji = '🛑';
      break;
    case 'yellow':
      emoji = '⚠️ ';
      break;
    case 'green':
      emoji = '✅';
      break;
  }
  return [color, emoji];
}
