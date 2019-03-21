"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.wait = wait;
exports.promisify = promisify;
exports.queue = queue;
function wait(delay) {
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
}

function promisify(fn, firstData) {
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

function queue(arr, promiseProducer, concurrency = Infinity) {
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