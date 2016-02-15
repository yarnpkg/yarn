/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
/* eslint quotes: 0 */

import stringify from "../src/lockfile/stringify.js";
import parse from "../src/lockfile/parse.js";
import nullify from "../src/util/map.js";

let test = require("ava");

let objs = [
  { foo: "bar" },
  { foo: {} },
  { foo: "foo", bar: "bar" },
  Object.assign({}, require("../package.json"), { ava: {} })
];

test("parse/stringify", (t) => {
  t.plan(objs.length);

  for (let obj of objs) {
    t.same(parse(stringify(obj)), nullify(obj));
  }
});

test("parse", (t) => {
  t.plan(6);

  t.same(parse('foo "bar"'), nullify({ foo: "bar" }));
  t.same(parse('"foo" "bar"'), nullify({ foo: "bar" }));
  t.same(parse('foo "bar"'), nullify({ foo: "bar" }));

  t.same(parse(`foo:\n  bar "bar"`), nullify({ foo: { bar: "bar" } }));
  t.same(parse(`foo:\n  bar:\n  foo "bar"`), nullify({ foo: { bar: {}, foo: "bar" } }));
  t.same(parse(`foo:\n  bar:\n    foo "bar"`), nullify({ foo: { bar: { foo: "bar" } } }));
});

test("stringify", (t) => {
  stringify;
  t;
});
