/* @flow */

import * as promise from '../../src/util/promise.js';

test('promisify', async function(): Promise<void> {
  expect(
    await promise.promisify(function(callback) {
      callback(null, 'foo');
    })(),
  ).toBe('foo');

  expect(
    await promise.promisify(function(data, callback) {
      callback(null, data + 'bar');
    })('foo'),
  ).toBe('foobar');

  expect(
    await promise.promisify(function(callback) {
      callback(null, 'foo', 'bar');
    })(),
  ).toEqual(['foo', 'bar']);

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

test('queue', async function(): Promise<void> {
  let running = 0;

  function create(): Promise<void> {
    running++;
    jest.runAllTimers();

    if (running > 5) {
      return Promise.reject(new Error('Concurrency is broken'));
    }

    running--;

    return Promise.resolve();
  }

  await promise.queue([], function() {
    throw new Error("Shouldn't be called");
  });

  await promise.queue(Array(10), create, 5);
});
