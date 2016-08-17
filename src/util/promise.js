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

export function wait(delay: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

export function promisify(fn: Function, firstData?: boolean): () => Promise<any> {
  return function(...args): Promise<any> {
    return new Promise(function(resolve, reject) {
      args.push(function(err, ...result) {
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
  [key: string]: () => Promise<any>
} {
  const promisedObj = {};
  for (const key in obj) {
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

  const results = [];
  let total = arr.length;
  if (!total) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    for (let i = 0; i < concurrency; i++) {
      next();
    }

    function next() {
      const item = arr.shift();
      const promise = promiseProducer(item);

      promise.then(function(result) {
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
