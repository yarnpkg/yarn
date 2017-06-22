/* @flow */

export function wait(delay: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
}

export function promisify(fn: Function, firstData?: boolean): (...args: Array<any>) => Promise<any> {
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

export function queue<T, U>(
  arr: Array<U>,
  promiseProducer: (result: U) => Promise<T>,
  concurrency: number = Infinity,
): Promise<Array<T>> {
  concurrency = Math.min(concurrency, arr.length);

  // clone
  arr = arr.slice();

  const results = [];
  let total = arr.length;
  if (!total) {
    return Promise.resolve(results);
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
