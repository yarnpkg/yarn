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

let temp = require('temp');

export default function(filename?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    temp.mkdir(filename, function(err, path) {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}
