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

const REGEXES = {
  WTFPL: [/DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE/, /WTFPL\b/],
  ISC: [/The ISC License/, /ISC\b/],
  APACHE: [/Apache License\b/],
  MIT: [/MIT\b/],
  BSD: [/BSD\b/]
};

export default function (license: string): ?string {
  for (let licenseName in REGEXES) {
    for (let regex of REGEXES[licenseName]) {
      if (regex.test(license)) {
        return `${licenseName}*`;
      }
    }
  }
}
