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

import { sortAlpha } from "../util/misc.js";

let _ = require("lodash");

function shouldWrapKey(str: string): boolean {
  return str.indexOf("true") === 0 || str.indexOf("false") === 0 ||
         /[:\s\n\\",]/g.test(str) || /^[0-9]/g.test(str) || !/^[a-zA-Z]/g.test(str);
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

export default function stringify(obj: Object, indent: string = ""): string {
  if (typeof obj !== "object") {
    throw new TypeError;
  }

  let lines = [];

  // Sorting order needs to be consistent between runs, we run native sort by name because there are no
  // problems with it being unstable because there are no to keys the same
  // However priorities can be duplicated and native sort can shuffle things from run to run
  let keys = Object.keys(obj).sort(sortAlpha);

  // stable sort, V8 Array.prototype.sort is not stable and we don't want to shuffle things randomly
  keys = _.sortBy(keys, getKeyPriority);

  let addedKeys = [];

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let val = obj[key];
    if (val == null) continue;
    if (addedKeys.indexOf(key) >= 0) continue;

    //
    let valKeys = [key];

    // get all keys that have the same value equality, we only want this for objects
    if (typeof val === "object") {
      for (let j = i + 1; j < keys.length; j++) {
        let key = keys[j];
        if (val === obj[key]) {
          valKeys.push(key);
        }
      }
    }

    //
    let keyLine = valKeys.sort(sortAlpha).map(maybeWrap).join(", ");

    if (typeof val === "string" || typeof val === "boolean" || typeof val === "number") {
      lines.push(`${keyLine} ${maybeWrap(val)}`);
    } else if (typeof val === "object") {
      lines.push(`${keyLine}:\n${stringify(val, indent + "  ")}`);
    } else {
      throw new TypeError;
    }

    addedKeys = addedKeys.concat(valKeys);
  }

  return indent + lines.join(`\n${indent}`);
}
