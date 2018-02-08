/* @flow */
import type {Manifest} from '../types.js';

export function getPlatformSpecificPackageFilename(pkg: Manifest): string {
  // TODO support platform variant for linux
  // TODO support hash for all subdependencies that have installs scripts
  const normaliseScope = name => (name[0] === '@' ? name.substr(1).replace('/', '-') : name);
  const suffix = `${process.platform}-${process.arch}-${process.versions.modules || ''}`;
  return `${normaliseScope(pkg.name)}-v${pkg.version}-${suffix}`;
}
