/* @flow */

export function getPlatformSpecificPackageFilename(pkg: {name: string, version: string}): string {
  // TODO support hash for all subdependencies that have installs scripts
  const normaliseScope = name => (name[0] === '@' ? name.substr(1).replace('/', '-') : name);
  const suffix = getSystemParams();
  return `${normaliseScope(pkg.name)}-v${pkg.version}-${suffix}`;
}

export function getSystemParams(): string {
  // TODO support platform variant for linux
  return `${process.platform}-${process.arch}-${process.versions.modules || ''}`;
}
