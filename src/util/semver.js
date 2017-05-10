/* @flow */

const semver = require('semver');

/**
 * Returns whether the given semver version satisfies the given range. Notably this supports
 * prerelease versions so that "2.0.0-rc.0" satisfies the range ">=1.0.0", for example.
 */

export function satisfiesWithPreleases(version: string, range: string, loose?: boolean = false): boolean {
  let semverRange;
  try {
    // $FlowFixMe: Add a definition for the Range class
    semverRange = new semver.Range(range, loose);
  } catch (err) {
    return false;
  }

  if (!version) {
    return false;
  }
  const semverVersion = new semver.SemVer(version, semverRange.loose);

  // A range has multiple sets of comparators. A version must satisfy all comparators in a set
  // and at least one set to satisfy the range.
  return semverRange.set.some((comparatorSet) =>
    !comparatorSet.some((comparator) => !comparator.test(semverVersion)),
  );
}
