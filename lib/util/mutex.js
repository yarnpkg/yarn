"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
const lockPromises = new Map();

/**
 * Acquires a mutex lock over the given key. If the lock can't be acquired, it waits until it's available.
 * @param key Key to get the lock for.
 * @return {Promise.<Function>} A Promise that resolves when the lock is acquired, with the function that
 * must be called to release the lock.
 */

exports.default = key => {
  let unlockNext;
  const willLock = new Promise(resolve => unlockNext = resolve);
  const lockPromise = lockPromises.get(key) || Promise.resolve();
  const willUnlock = lockPromise.then(() => unlockNext);
  lockPromises.set(key, lockPromise.then(() => willLock));
  return willUnlock;
};