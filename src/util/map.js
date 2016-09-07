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
  return nullify(obj);
}

export function nullify<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(nullify);
  } else if (obj !== null && typeof obj === 'object' || typeof obj === 'function') {
    Object.setPrototypeOf(obj, null);
    for (const key in obj) {
      obj[key] = nullify(obj[key]);
    }
    return obj;
  } else if (typeof obj === 'string') {
    return normalizeLineEndings(obj);
  }

  return obj;
}

function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/, '\n');
}