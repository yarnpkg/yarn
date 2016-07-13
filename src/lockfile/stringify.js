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

function shouldWrapKey(str: string): boolean {
  return str.indexOf("true") === 0 || str.indexOf("false") === 0 ||
         /[:\s\n\\"]/g.test(str) || /^[0-9]/g.test(str) || !/^[a-zA-Z]/g.test(str);
}

function maybeWrap(str: string): string {
  if (typeof str === "boolean" || typeof str === "number" || shouldWrapKey(str)) {
    return JSON.stringify(str);
  } else {
    return str;
  }
}

const priorities = {
  name: 1,
  version: 2,
  uid: 3,
  resolved: 4,
  registry: 5,
  dependencies: 6
};

function getKeyPriority(key: string): number {
  return priorities[key] || 100;
}

export default function stringify(obj: any, indent: string = ""): string {
  if (typeof obj !== "object") {
    throw new TypeError;
  }

  let lines = [];

  // Sorting order needs to be consistent between runs, we run native sort by name because there are no
  // problems with it being unstable because there are no to keys the same
  // However priorities can be duplicated and native sort can shuffle things from run to run
  let keys = Object.keys(obj)
    .sort(function (a, b) {
      // sort alphabetically
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

  // stable sort, V8 Array.prototype.sort is not stable and we don't want to shuffle things randomly
  keys = _.sortBy(keys, getKeyPriority);

  for (let key of keys) {
    let val = obj[key];
    if (val == null) continue;

    key = maybeWrap(key);

    if (typeof val === "string" || typeof val === "boolean" || typeof val === "number") {
      lines.push(`${key} ${maybeWrap(val)}`);
    } else if (typeof val === "object") {
      lines.push(`${key}:\n${stringify(val, indent + "  ")}`);
    } else {
      throw new TypeError;
    }
  }

  return indent + lines.join(`\n${indent}`);
}
