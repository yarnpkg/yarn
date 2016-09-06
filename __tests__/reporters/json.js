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
/* eslint quotes: 0 */

import type {MockData} from "./_mock.js";
import JSONReporter from "../../src/reporters/json-reporter.js";
import build from "./_mock.js";

let getJSONBuff = build(JSONReporter, (data): MockData => data);

test("JSONReporter.step", async () => {
  expect(await getJSONBuff((r) => {
    r.step(1, 5, "foobar");
  })).toMatchSnapshot();
});

test("JSONReporter.footer", async () => {
  expect(await getJSONBuff((r) => {
    r.footer(false);
  })).toMatchSnapshot();
});

test("JSONReporter.log", async () => {
  expect(await getJSONBuff((r) => {
    r.log("foobar");
  })).toMatchSnapshot();
});

test("JSONReporter.command", async () => {
  expect(await getJSONBuff((r) => {
    r.command("foobar");
  })).toMatchSnapshot();
});

test("JSONReporter.success", async () => {
  expect(await getJSONBuff((r) => {
    r.success("foobar");
  })).toMatchSnapshot();
});

test("JSONReporter.error", async () => {
  expect(await getJSONBuff((r) => {
    r.error("foobar");
  })).toMatchSnapshot();
});

test("JSONReporter.warn", async () => {
  expect(await getJSONBuff((r) => {
    r.warn("foobar");
  })).toMatchSnapshot();
});

test("JSONReporter.info", async () => {
  expect(await getJSONBuff((r) => {
    r.info("foobar");
  })).toMatchSnapshot();
});

test("JSONReporter.activity", async () => {
  expect(await getJSONBuff(async function (r) {
    let activity = await r.activity();
    activity.tick("foo");
    activity.tick("bar");
    activity.end();
  })).toMatchSnapshot();
});

test("JSONReporter.progress", async () => {
  expect(await getJSONBuff(async function (r) {
    let tick = await r.progress(2);
    tick();
    tick();
  })).toMatchSnapshot();
});
