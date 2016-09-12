/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

const path = require('path');
const fs = require('fs');

function clean(str: string): string {
  return str
    .replace(/[^A-Za-z\s]/g, ' ')
    .replace(/[\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

function createExplicitLicenseRegex(license: string): RegExp {
  let regex = clean(license);
  regex = regex.replace(/ wildcard /g, '(.*?| )');
  regex += '$'; // matches end of string
  return new RegExp(regex, 'g');
}

const LICENSES = {};
const licensesDir = path.join(__dirname, 'licenses');
for (let name of fs.readdirSync(licensesDir)) {
  let regex = createExplicitLicenseRegex(fs.readFileSync(
    path.join(licensesDir, name),
    'utf8',
  ));
  let key = name.replace(/_(\d)+$/g, '');
  let existing = LICENSES[key];
  if (existing) {
    LICENSES[key] = new RegExp(`(${regex.source}|${existing.source})`, 'g');
  } else {
    LICENSES[key] = regex;
  }
}

const REGEXES = {
  WTFPL: [/DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE/, /WTFPL\b/],
  ISC: [/The ISC License/, /ISC\b/],
  Apache: [/Apache License\b/],
  MIT: [/MIT\b/],
  BSD: [/BSD\b/],
};

export default function inferLicense(license: string): ?string {
  // check if we have any explicit licenses
  const cleanLicense = clean(license);
  for (const licenseName in LICENSES) {
    const testLicense = LICENSES[licenseName];
    if (cleanLicense.search(testLicense) >= 0) {
      return licenseName;
    }
  }

  // infer based on some keywords
  for (const licenseName in REGEXES) {
    for (const regex of REGEXES[licenseName]) {
      if (license.search(regex) >= 0) {
        return `${licenseName}*`;
      }
    }
  }

  return null;
}
