/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import JSONReporter from "../../src/reporters/json.js";
import build from "./_build.js";

let test = require("ava");

let getJSONBuff = build(JSONReporter, (data) => data);

test("JSONReporter.step", async (t) => {
  t.same(await getJSONBuff((r) => r.step(1, 5, "foobar")), {
    stderr: [],
    stdout: [
      '{"type":"step","data":{"message":"foobar","current":1,"total":5}}'
    ]
  });
});

test("JSONReporter.footer", async (t) => {
  t.same(await getJSONBuff((r) => r.footer()), {
    stderr: [],
    stdout: [
      '{"type":"finished","data":0}'
    ]
  });
});

test("JSONReporter.log", async (t) => {
  t.same(await getJSONBuff((r) => r.log("foobar")), {
    stderr: [],
    stdout: [
      '{"type":"log","data":"foobar"}'
    ]
  });
});

test("JSONReporter.command", async (t) => {
  t.same(await getJSONBuff((r) => r.command("foobar")), {
    stderr: [],
    stdout: [
      '{"type":"command","data":"foobar"}'
    ]
  });
});

test("JSONReporter.success", async (t) => {
  t.same(await getJSONBuff((r) => r.success("foobar")), {
    stderr: [],
    stdout: [
      '{"type":"success","data":"foobar"}'
    ]
  });
});

test("JSONReporter.error", async (t) => {
  t.same(await getJSONBuff((r) => r.error("foobar")), {
    stderr: [
      '{"type":"error","data":"foobar"}'
    ],
    stdout: []
  });
});

test("JSONReporter.warn", async (t) => {
  t.same(await getJSONBuff((r) => r.warn("foobar")), {
    stderr: [
      '{"type":"warning","data":"foobar"}'
    ],
    stdout: []
  });
});

test("JSONReporter.info", async (t) => {
  t.same(await getJSONBuff((r) => r.info("foobar")), {
    stderr: [],
    stdout: [
      '{"type":"info","data":"foobar"}'
    ]
  });
});

test("JSONReporter.activity", async (t) => {
  t.same(await getJSONBuff(async function (r) {
    let activity = await r.activity();
    activity.tick();
    activity.tick();
    activity.end();
  }), {
    stderr: [],
    stdout: [
      '{"type":"activityStart","data":{"id":0}}',
      '{"type":"activitytick","data":{"id":0}}',
      '{"type":"activitytick","data":{"id":0}}',
      '{"type":"activityEnd","data":{"id":0}}'
    ]
  });
});

test("JSONReporter.progress", async (t) => {
  t.same(await getJSONBuff(async function (r) {
    let tick = await r.progress(2);
    tick();
    tick();
  }), {
    stderr: [],
    stdout: [
      '{"type":"progressStart","data":{"id":0,"total":2}}',
      '{"type":"progressTick","data":{"id":0,"current":1}}',
      '{"type":"progressTick","data":{"id":0,"current":2}}',
      '{"type":"progressFinish","data":{"id":0}}'
    ]
  });
});
