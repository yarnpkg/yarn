/* @flow */

import BlockingQueue from '../../src/util/blocking-queue.js';

test('max concurrency', async function (): Promise<void> {
  let queue = new BlockingQueue('test', 5);
  let i = 0;
  let running = 0;

  function create(): Promise<void> {
    return queue.push(++i + '', async function (): Promise<void> {
      running++;
      jest.runAllTimers();

      if (running > 5)  {
        throw new Error('Concurrency is broken');
      }

      running--;
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
});
