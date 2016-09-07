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

let test = require('ava');

test('promisify', async function (t) {
  t.is(await promise.promisify(function(callback) {
    callback(null, 'foo');
  })(), 'foo');

  t.is(await promise.promisify(function(data, callback) {
    callback(null, data + 'bar');
  })('foo'), 'foobar');

  t.deepEqual(await promise.promisify(function(callback) {
    callback(null, 'foo', 'bar');
  })(), ['foo', 'bar']);

  let error;
  try {
    await promise.promisify(function(callback) {
      callback(new Error('yep'));
    })();
  } catch (e) {
    error = e;
  }
  t.is(error && error.message, 'yep');
});

test('promisifyObject', async function (t) {
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

  t.is(await obj.foo(), 'foo');
  t.is(await obj.bar('foo'), 'foobar');
  let error;
  try {
    await obj.foobar();
  } catch (e) {
    error = e;
  }
  t.is(error && error.message, 'yep');
});

test('queue', async function () {
  let running = 0;

  async function create() {
    running++;

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
