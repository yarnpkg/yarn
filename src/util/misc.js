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

let _ = require("lodash");

export function entries<T>(obj: ?{ [key: string]: T }): Array<[string, T]> {
  let entries = [];
  if (obj) {
    for (let key in obj) {
      entries.push([key, obj[key]]);
    }
  }
  return entries;
}

export function removePrefix(pattern: string, prefix: string): string {
  if (pattern.indexOf(prefix) === 0) {
    pattern = pattern.slice(prefix.length);
  }

  return pattern;
}

export function removeSuffix(pattern: string, suffix: string): string {
  if (_.endsWith(pattern, suffix)) {
    return pattern.slice(0, -suffix.length);
  }

  return pattern;
}
