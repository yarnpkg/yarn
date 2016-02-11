/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import { analyse } from "..";

let expect = require("unexpected");
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

    // the unexpected library does a "subset" comparison
    expect(actual, "to satisfy", expected);
  });
}
