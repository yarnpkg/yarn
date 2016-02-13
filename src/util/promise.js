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

export function promisify(fn: Function, firstData?: boolean): () => Promise {
  return function (...args) {
    return new Promise(function (resolve, reject) {
      args.push(function (err, ...result) {
        let res = result;

        if (result.length <= 1) {
          res = result[0];
        }

        if (firstData) {
          res = err;
          err = null;
        }

        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });

      fn.apply(null, args);
    });
  };
}

export function promisifyObject(obj: {
  [key: string]: Function
}): {
  [key: string]: () => Promise
} {
  let promisedObj = {};
  for (let key in obj) {
    promisedObj[key] = promisify(obj[key]);
  }
  return promisedObj;
}

export function queue<T>(
  arr: Array<any>,
  promiseProducer: (result: any) => Promise<T>,
  concurrency: number = Infinity,
): Promise<Array<T>> {
  concurrency = Math.min(concurrency, arr.length);

  // clone
  arr = arr.slice();

  let results = [];
  let total = arr.length;
  if (!total) return Promise.resolve();

  return new Promise((resolve, reject) => {
    for (let i = 0; i < concurrency; i++) next();

    function next() {
      let item = arr.shift();
      let promise = promiseProducer(item);

      promise.then(function (result) {
        results.push(result);

        total--;
        if (total === 0) {
          resolve(results);
        } else {
          if (arr.length) {
            next();
          }
        }
      }, reject);
    }
  });
}
