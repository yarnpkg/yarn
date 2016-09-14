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

import * as promise from '../../src/util/promise.js';

test('promisify', async function (): Promise<void> {
  expect(await promise.promisify(function(callback) {
    callback(null, 'foo');
  })()).toBe('foo');

  expect(await promise.promisify(function(data, callback) {
    callback(null, data + 'bar');
  })('foo')).toBe('foobar');

  expect(await promise.promisify(function(callback) {
    callback(null, 'foo', 'bar');
  })()).toEqual(['foo', 'bar']);

  let error;
  try {
    await promise.promisify(function(callback) {
      callback(new Error('yep'));
    })();
  } catch (e) {
    error = e;
  }
  expect(error && error.message).toEqual('yep');
});

test('promisifyObject', async function (): Promise<void> {
  let obj = promise.promisifyObject({
    foo(callback) {
      callback(null, 'foo');
    },

    bar(data, callback) {
      callback(null, data + 'bar');
    },

    foobar(callback) {
      callback(new Error('yep'));
    },
  });

  expect(await obj.foo()).toBe('foo');
  expect(await obj.bar('foo')).toBe('foobar');
  let error;
  try {
    await obj.foobar();
  } catch (e) {
    error = e;
  }
  expect(error && error.message).toEqual('yep');
});

test('queue', async function (): Promise<void> {
  let running = 0;

  async function create(): Promise<void> {
    running++;
    jest.runAllTimers();

    if (running > 5)  {
      throw new Error('Concurrency is broken');
    }

    running--;
  }

  await promise.queue([], function() {
    throw new Error("Shouldn't be called");
  });

  await promise.queue(Array(10), create, 5);
});
