#!/usr/bin/env node
/**
 * Generates a `package.json` file for the Yarn distributable. This is based on
 * the root package.json, with the following differences:
 * - It has an `installationMethod` field that's set to the method used to
 *   install Yarn (eg. "tar", "brew", "msi")
 * - It doesn't include any of the dependencies, as they are bundled in the Yarn
 *   JS file itself.
 */

const fs = require('fs');

const packageManifestFilename = process.argv[2];
const packageManifest = require(packageManifestFilename);

packageManifest.installationMethod = process.argv[3];
delete packageManifest.dependencies;
delete packageManifest.devDependencies;
delete packageManifest.scripts;
delete packageManifest.jest;
fs.writeFileSync(
  packageManifestFilename,
  JSON.stringify(packageManifest, null, 2) + '\n'
);
