/**
 * Determines the current version of Yarn itself.
 * @flow
 */

import {readJson} from './fs';

import fs from 'fs';
import path from 'path';

// This will be bundled directly in the .js file for production builds
const {version, installationMethod: originalInstallationMethod} = require('../../package.json');
export {version};

export async function getInstallationMethod(): Promise<InstallationMethod> {
  let installationMethod = originalInstallationMethod;

  // If there's a package.json in the parent directory, it could have an
  // override for the installation method, so we should prefer that over
  // whatever was originally in Yarn's package.json. This is the case with
  // systems such as Homebrew, which take the tarball and modify the
  // installation method so we're aware of the fact that Yarn was installed via
  // Homebrew (so things like update notifications can point out the correct
  // command to upgrade).
  try {
    const manifestPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(manifestPath)) {
      // non-async version is deprecated
      const manifest = await readJson(manifestPath);
      if (manifest.installationMethod) {
        installationMethod = manifest.installationMethod;
      }
    }
  } catch (e) {
    // Ignore any errors; this is not critical functionality.
  }
  return installationMethod;
}

export type InstallationMethod =
  | 'tar'
  | 'homebrew'
  | 'deb'
  | 'rpm'
  | 'msi'
  | 'chocolatey'
  | 'apk'
  | 'npm'
  | 'portage'
  | 'unknown';
