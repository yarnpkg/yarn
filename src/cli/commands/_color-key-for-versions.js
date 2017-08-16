/* @flow */

import type {FormatKeys} from '../../reporters/format.js';
import semver from 'semver';

const versionColorScheme = {
  major: 'red',
  premajor: 'red',
  minor: 'yellow',
  preminor: 'yellow',
  patch: 'green',
  prepatch: 'green',
  prerelease: 'red',
  unchanged: 'white',
  unknown: 'red',
};

export default function(from: string, to: string): FormatKeys {
  const [validFrom, validTo] = [semver.valid(from), semver.valid(to)];
  if (validFrom && validTo) {
    return versionColorScheme[semver.diff(validFrom, validTo) || 'unchanged'];
  }
  return versionColorScheme.unknown;
}
