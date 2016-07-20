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
/* eslint max-len: 0 */

import normaliseManifest from "../src/util/normalise-manifest/index.js";
import map from "../src/util/map.js";
import * as util from "../src/util/normalise-manifest/util.js";
import * as fs from "../src/util/fs.js";

let nativeFs = require("fs");
let test     = require("ava");
let path     = require("path");

let fixturesLoc = path.join(__dirname, "fixtures", "normalise-manifest");

for (let name of nativeFs.readdirSync(fixturesLoc)) {
  if (name[0] === ".") continue;

  let loc = path.join(fixturesLoc, name);

  test(name, async (t) => {
    let actualWarnings   = [];
    let expectedWarnings = await fs.readJson(path.join(loc, "warnings.json"));

    function warn(msg) {
      actualWarnings.push(msg);
    }

    let actual   = await fs.readJson(path.join(loc, "actual.json"));
    let expected = await fs.readJson(path.join(loc, "expected.json"));

    let error = expected._error;
    if (error) {
      delete expected._error;
    }

    try {
      actual = await normaliseManifest(actual, loc, warn);
    } catch (err) {
      if (error && err.message === error) {
        return;
      } else {
        throw err;
      }
    }

    t.deepEqual(map(actual), map(expected));
    t.deepEqual(actualWarnings, expectedWarnings);
  });
}

test("util.stringifyPerson", (t) => {
  t.deepEqual(util.stringifyPerson({ name: "Sebastian McKenzie" }), "Sebastian McKenzie");
  t.deepEqual(util.stringifyPerson({ name: "Sebastian McKenzie", email: "sebmck@gmail.com" }), "Sebastian McKenzie <sebmck@gmail.com>");
  t.deepEqual(util.stringifyPerson({ email: "sebmck@gmail.com" }), "<sebmck@gmail.com>");
  t.deepEqual(util.stringifyPerson({ name: "Sebastian McKenzie", email: "sebmck@gmail.com", url: "https://sebmck.com" }), "Sebastian McKenzie <sebmck@gmail.com> (https://sebmck.com)");
});

test("util.parsePerson", (t) => {
  t.deepEqual(util.parsePerson({}), {});
  t.deepEqual(util.parsePerson("Sebastian McKenzie"), { name: "Sebastian McKenzie" });
  t.deepEqual(util.parsePerson(" <sebmck@gmail.com>"), { email: "sebmck@gmail.com" });
  t.deepEqual(util.parsePerson("Sebastian McKenzie <sebmck@gmail.com>"), { name: "Sebastian McKenzie", email: "sebmck@gmail.com" });
  t.deepEqual(util.parsePerson("Sebastian McKenzie <sebmck@gmail.com> (https://sebmck.com)"), { name: "Sebastian McKenzie", email: "sebmck@gmail.com", url: "https://sebmck.com" });
});

test("util.extractDescription", (t) => {
  t.deepEqual(util.extractDescription("# header\n\ndescription here"), "description here");
  t.deepEqual(util.extractDescription("# header\ndescription here"), "description here");
  t.deepEqual(util.extractDescription("# header\ndescription here\nfoobar"), "description here foobar");
  t.deepEqual(util.extractDescription("# header\ndescription here\n\nfoobar"), "description here");
  t.deepEqual(util.extractDescription(""), undefined);
  t.deepEqual(util.extractDescription(null), undefined);
  t.deepEqual(util.extractDescription(undefined), undefined);
});
