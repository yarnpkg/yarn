/* @flow */

import map from "./map.js";

export default class BlockingQueue {
  constructor(alias: string, maxConcurrency?: number = Infinity) {
    this.concurrencyQueue = [];
    this.maxConcurrency   = maxConcurrency;
    this.runningCount     = 0;
    this.alias            = alias;

    this.running      = map();
    this.queue        = map();

    this.startStuckTimer();
  }

  concurrencyQueue: Array<Function>;
  maxConcurrency: number;
  runningCount: number;
  stuckTimer: ?number;
  alias: string;

  queue: {
    [key: string]: Array<{
      factory: () => Promise<any>,
      resolve: (val: any) => void,
      reject: Function
    }>
  };

  running: {
    [key: string]: boolean
  };

  startStuckTimer() {
    if (this.stuckTimer) {
      clearTimeout(this.stuckTimer);
    }

    this.stuckTimer = setTimeout(() => {
      if (this.runningCount === 1) {
        console.warn(
          `[kpm] The ${JSON.stringify(this.alias)} blocking queue may be stuck. 5 seconds ` +
          `without any activity with 1 worker: ${Object.keys(this.running)[0]}`
        );
      }
    }, 5000);
  }

  push<T>(key: string, factory: () => Promise<T>): Promise<T> {
    this.startStuckTimer();

    return new Promise((resolve, reject) => {
      // we're already running so push ourselves to the queue
      let queue = this.queue[key] = this.queue[key] || [];
      queue.push({ factory, resolve, reject });

      if (!this.running[key]) {
        this.shift(key);
      }
    });
  }

  shift(key: string) {
    if (this.running[key]) {
      delete this.running[key];
      this.runningCount--;
    }

    let queue = this.queue[key];
    if (!queue) return;

    let { resolve, reject, factory } = queue.shift();
    if (!queue.length) delete this.queue[key];

    let next = () => {
      this.shift(key);
      this.shiftConcurrencyQueue();
    };

    let run = () => {
      this.running[key] = true;
      this.runningCount++;

      factory().then(function (val) {
        resolve(val);
        next();
        return null;
      }).catch(function (err) {
        reject(err);
        next();
      });
    };

    this.maybePushConcurrencyQueue(run);
  }

  maybePushConcurrencyQueue(run: Function) {
    if (this.runningCount < this.maxConcurrency) {
      run();
    } else {
      this.concurrencyQueue.push(run);
    }
  }

  shiftConcurrencyQueue() {
    if (this.runningCount < this.maxConcurrency) {
      let fn = this.concurrencyQueue.shift();
      if (fn) fn();
    }
  }
}
