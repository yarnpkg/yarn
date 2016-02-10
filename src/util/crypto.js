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

let through = require("through2");
let crypto  = require("crypto");

export function hash(content: string, type: string = "md5"): string {
  return crypto.createHash(type).update(content).digest("hex");
}

export function hashStreamValidation(): {
  getHash: () => string,
  test: (sum: string) => boolean;
} {
  let hash = crypto.createHash("sha1");
  let updated = false;

  let validationStream = through(function (chunk, enc, done) {
    updated = true;
    hash.update(chunk);
    done(null, chunk);
  });

  validationStream.getHash = () => hash.digest("hex");

  validationStream.test = (sum) => updated && sum === validationStream.getHash();

  return validationStream;
}
