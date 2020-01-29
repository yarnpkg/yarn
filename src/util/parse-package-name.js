/* @flow */

type PackageInput = {
  name: string,
  version: ?string,
};

const PKG_INPUT = /(^\S?[^\s@]+)(?:@(\S+))?$/;

export default function parsePackageName(input: string): PackageInput {
  const pkgInputMatches = PKG_INPUT.exec(input);
  let name = '';
  let version = '';

  if (pkgInputMatches !== null && pkgInputMatches.length >= 3) {
    name = pkgInputMatches[1];
    version = pkgInputMatches[2];
  }
  return {name, version};
}
