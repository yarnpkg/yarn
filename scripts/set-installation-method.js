#!/usr/bin/env node
/**
 * Sets the installationMethod field in package.json. Useful for setting it in
 * shell scripts.
 */

const fs = require('fs');

const packageManifestFilename = process.argv[2];
const packageManifest = require(packageManifestFilename);
packageManifest.installationMethod = process.argv[3];
fs.writeFileSync(
  packageManifestFilename,
  JSON.stringify(packageManifest, null, 2) + '\n',
);
