/**
 * Determines the current version of Yarn itself.
 * @flow
 */

import fs from 'fs';
import path from 'path';

function getVersion(): {version: string, installationMethod: string} {
  // This will be bundled directly in the .js file for production builds
  const data = require('../../package.json');

  // If there's a package.json in the parent directory, it could have an
  // override for the installation method, so we should prefer that over
  // whatever was originally in Yarn's package.json. This is the case with
  // systems such as Homebrew, which take the tarball and modify the
  // installation method so we're aware of the fact that Yarn was installed via
  // Homebrew (so things like update notifications can point out the correct
  // command to upgrade).
  const manifestPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    data.installationMethod = manifest.installationMethod;
  }
  return data;
}

export const {version, installationMethod} = getVersion();
