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

import BlockingQueue from '../../src/util/blocking-queue.js';

test('max concurrency', async function () {
  let queue = new BlockingQueue('test', 5);
  let i = 0;
  let running = 0;

  function create(): Promise<void> {
    return queue.push(++i + '', async function () {
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
