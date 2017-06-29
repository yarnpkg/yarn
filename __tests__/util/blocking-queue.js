/* @flow */

import BlockingQueue from '../../src/util/blocking-queue.js';

test('max concurrency', async function(): Promise<void> {
  jest.useFakeTimers();

  const queue = new BlockingQueue('test', 5);
  let i = 0;
  let running = 0;

  function create(): Promise<void> {
    return queue.push(++i + '', (): Promise<void> => {
      running++;
      jest.runAllTimers();

      if (running > 5) {
        return Promise.reject(new Error('Concurrency is broken'));
      }

      running--;

      return Promise.resolve();
    });
  }

  await Promise.all([
    create(),
    create(),
    create(),
    create(),
    create(),
    create(),
    create(),
    create(),
    create(),
    create(),
  ]);

  jest.useRealTimers();
});
