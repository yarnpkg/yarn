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

type Return<T> = T | Object;

export default function nullify<T>(obj?: Return<T> = {}): Return<T> {
  if (Array.isArray(obj)) {
    for (let item of obj) {
      nullify(item);
    }
  } else if (obj !== null && typeof obj === "object" || typeof obj === "function") {
    Object.setPrototypeOf(obj, null);
    for (let key in obj) {
      nullify(obj[key]);
    }
  }

  return obj;
}
