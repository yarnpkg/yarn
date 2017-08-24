/* @flow */

const PACKAGE_SEP = '/';

/**
 * Parse input strings like `package-1/package-2` to an array of packages
 */
export default function parsePackagePath(input: string): string[] {
  const packages = [];

  let prevScoped = false;
  for (const pkg of input.split(PACKAGE_SEP)) {
    if (prevScoped) {
      // If package is scoped, then we should concat it's name to the prev part
      packages[packages.length - 1] += PACKAGE_SEP + pkg;
      prevScoped = false;
    } else {
      packages.push(pkg);
    }

    if (pkg.indexOf('@') !== -1) {
      prevScoped = true;
    }
  }

  return packages;
}
