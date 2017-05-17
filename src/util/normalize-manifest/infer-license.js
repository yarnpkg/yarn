/* @flow */

import LICENSES from './licenses.js';

function clean(str: string): string {
  return str.replace(/[^A-Za-z\s]/g, ' ').replace(/[\s]+/g, ' ').trim().toLowerCase();
}

const REGEXES: {[key: string]: Array<RegExp>} = {
  Apache: [/Apache License\b/],
  BSD: [/BSD\b/],
  ISC: [/The ISC License/, /ISC\b/],
  MIT: [/MIT\b/],
  Unlicense: [/http:\/\/unlicense.org\//],
  WTFPL: [/DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE/, /WTFPL\b/],
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
