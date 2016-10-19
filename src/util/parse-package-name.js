/* @flow */

type PackageInput = {
  name: string,
  version: ?string,
};

const PKG_INPUT = /(^\S?[^\s@]+)(?:@(\S+))?$/;

export default function parsePackageName(input: string): PackageInput {
  const [, name, version] = PKG_INPUT.exec(input);
  return {name, version};
}
