#!/usr/bin/env node
/**
 * Sets a a nice build number when building nightly builds
 * (eg. "0.16.0-20161019.1800")
 */

const fs = require('fs');

// Leading `0` aren't valid semver, so we round it up to 10 to
// avoid having to change the nightly version format.
function roundToTen(value) {
  return value < 10 ? 10 : value;
}

function leftPad(value) {
  return (value < 10 ? '0' : '') + value;
}

const packageManifestFilename = __dirname + '/../package.json';
const packageManifest = require(packageManifestFilename);
const date = new Date();
const formattedDate =
  date.getUTCFullYear() +
  leftPad(date.getUTCMonth() + 1) +
  leftPad(date.getUTCDate()) +
  '.' +
  leftPad(roundToTen(date.getUTCHours())) +
  leftPad(date.getUTCMinutes());

// Remove any existing suffix before appending the date
const version =
  packageManifest.version.replace(/\-(.+)$/, '') + '-' + formattedDate;

packageManifest.version = version;
fs.writeFileSync(
  packageManifestFilename,
  JSON.stringify(packageManifest, null, 2) + '\n'
);

console.log('Updated version number to ' + version);
