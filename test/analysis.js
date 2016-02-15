/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import { analyse } from "../src/analysis/index.js";
import * as similarity from "../src/analysis/text/similarity.js";

let expect = require("unexpected");
let repeat = require("repeating");
let path   = require("path");
let test   = require("ava");
let fs     = require("fs");

let fixturesLoc = path.join(__dirname, "fixtures", "analysis");

for (let name of fs.readdirSync(fixturesLoc)) {
  let loc = path.join(fixturesLoc, name);

  let a = path.join(loc, "a");
  let b = path.join(loc, "b");

  let expected = require(path.join(loc, "expected.json"));

  test(name, async function () {
    let actual = await analyse(a, b);
    expect(actual, "to satisfy", expected);
  });
}

test("text similarity", (t) => {
  t.is(similarity.default("", ""), 1);
  t.is(similarity.default("foo", "foo"), 1);
  t.is(similarity.default(repeat("foo", 200), repeat("foo", 200)), 1);
});

test("text similarity leven", (t) => {
  t.is(similarity.leven("", ""), 1);
  t.is(similarity.leven("foo", "bar"), 0);
  t.is(similarity.leven("foo", ""), 0);
  t.is(similarity.leven("foo", "foo"), 1);
  t.is(similarity.leven("a", "b"), 0);
  t.is(similarity.leven("ab", "ac"), 0.5);
  t.is(similarity.leven("ac", "bc"), 0.5);
  t.is(similarity.leven("abc", "axc"), 0.6666666666666667);
  t.is(similarity.leven("kitten", "sitting"), 0.5714285714285714);
  t.is(similarity.leven("xabxcdxxefxgx", "1ab2cd34ef5g6"), 0.5384615384615384);
  t.is(similarity.leven("cat", "cow"), 0.33333333333333337);
  t.is(similarity.leven("xabxcdxxefxgx", "abcdefg"), 0.5384615384615384);
  t.is(similarity.leven("javawasneat", "scalaisgreat"), 0.41666666666666663);
  t.is(similarity.leven("example", "samples"), 0.5714285714285714);
  t.is(similarity.leven("sturgeon", "urgently"), 0.25);
  t.is(similarity.leven("levenshtein", "frankenstein"), 0.5);
  t.is(similarity.leven("distance", "difference"), 0.5);
});

test("text similarity lines", (t) => {
  t.is(similarity.lines("", ""), 1);
  t.is(similarity.lines("foo", "bar"), 0);
  t.is(similarity.lines("foo\nbar", "bar"), 0.5);
  t.is(similarity.lines("foo\nbar\nlol", "bar"), 0.3333333333333333);
});
