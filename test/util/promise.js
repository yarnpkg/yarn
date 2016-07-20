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

import * as promise from "../../src/util/promise.js";

let test = require("ava");

test("promisify", async function (t) {
  t.deepEqual(await promise.promisify(function (callback) {
    callback(null, "foo");
  })(), "foo");

  t.deepEqual(await promise.promisify(function (data, callback) {
    callback(null, data + "bar");
  })("foo"), "foobar");

  t.deepEqual(await promise.promisify(function (callback) {
    callback(null, "foo", "bar");
  })(), ["foo", "bar"]);

  t.throws(promise.promisify(function (callback) {
    callback(new Error("yep"));
  })(), "yep");
});

test("promisifyObject", async function (t) {
  let obj = promise.promisifyObject({
    foo: function (callback) {
      callback(null, "foo");
    },

    bar: function (data, callback) {
      callback(null, data + "bar");
    },

    foobar: function (callback) {
      callback(new Error("yep"));
    }
  });

  t.deepEqual(await obj.foo(), "foo");
  t.deepEqual(await obj.bar("foo"), "foobar");
  t.throws(obj.foobar(), "yep");
});

test("queue", async function () {
  let running = 0;

  async function create() {
    running++;
    await promise.wait(100);

    if (running > 5)  {
      throw new Error("Concurrency is broken");
    }

    running--;
  }

  await promise.queue([], function () {
    throw new Error("Shouldn't be called");
  });

  await promise.queue(Array(10), create, 5);
});
