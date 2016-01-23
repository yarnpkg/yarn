/* @flow */

export class BlockingQueue<T> {
  constructor(maxConcurrency?: number = Infinity) {
    this.concurrencyQueue = [];
    this.maxConcurrency   = maxConcurrency;
    this.runningCount     = 0;

    this.running      = Object.create(null);
    this.queue        = Object.create(null);
  }

  concurrencyQueue: Array<Function>;
  maxConcurrency: number;
  runningCount: number;

  queue: {
    [key: string]: Array<{
      factory: () => Promise<T>,
      resolve: (val: T) => void,
      reject: Function
    }>
  };

  running: {
    [key: string]: boolean
  };

  push(key: string, factory: () => Promise<T>): Promise<T> {
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
      this.running[key] = false;
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

    this.concurrencyQueue.push(run);
    this.shiftConcurrencyQueue();
  }

  shiftConcurrencyQueue() {
    if (this.runningCount < this.maxConcurrency) {
      let fn = this.concurrencyQueue.shift();
      if (fn) fn();
    }
  }
}

export default (new BlockingQueue: BlockingQueue<any>);
