/**
 * @flow
 */

import crypto from 'crypto';

export function mapObject<S: *, F: (*) => *>(obj: S, f: F): $ObjMap<S, F> {
  let nextObj = {};
  for (var k in obj) {
    nextObj[k] = f(obj[k], k);
  }
  return nextObj;
}

export function flattenArray<T>(arrayOfArrays: Array<Array<T>>): Array<T> {
  return [].concat(...arrayOfArrays);
}

export function hash(str: string): string {
  const hash = crypto.createHash('sha1')
  hash.update(str)
  return hash.digest('hex')
}
