/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import { getPathKey } from "../src/constants.js";

let test = require("ava");

test("getPathKey", (t) => {
  t.deepEqual(getPathKey("win32", { PATH: "foobar" }), "PATH");
  t.deepEqual(getPathKey("win32", { Path: "foobar" }), "Path");
  t.deepEqual(getPathKey("win32", { PaTh: "foobar" }), "PaTh");
  t.deepEqual(getPathKey("win32", {}), "Path");
  t.deepEqual(getPathKey("linux", {}), "PATH");
  t.deepEqual(getPathKey("darwin", {}), "PATH");
});
