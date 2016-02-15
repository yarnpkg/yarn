/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import BaseReporter from "../../src/reporters/_base.js";

let test = require("ava");

test("BaseReporter.getTotalTime", (t) => {
  let reporter = new BaseReporter;
  t.ok(reporter.getTotalTime() <= 1);
  reporter.close();
});

test("BaseReporter.step", () => {
  let reporter = new BaseReporter;
  reporter.step(1, 5, "foo");
  reporter.close();
});

test("BaseReporter.error", () => {
  let reporter = new BaseReporter;
  reporter.error("");
  reporter.close();
});

test("BaseReporter.warn", () => {
  let reporter = new BaseReporter;
  reporter.warn("");
  reporter.close();
});

test("BaseReporter.success", () => {
  let reporter = new BaseReporter;
  reporter.success("");
  reporter.close();
});

test("BaseReporter.log", () => {
  let reporter = new BaseReporter;
  reporter.log("");
  reporter.close();
});

test("BaseReporter.info", () => {
  let reporter = new BaseReporter;
  reporter.log("");
  reporter.close();
});

test("BaseReporter.command", () => {
  let reporter = new BaseReporter;
  reporter.command();
  reporter.close();
});

test("BaseReporter.header", () => {
  let reporter = new BaseReporter;
  reporter.header("");
  reporter.close();
});

test("BaseReporter.footer", () => {
  let reporter = new BaseReporter;
  reporter.footer();
  reporter.close();
});

test("BaseReporter.activity", () => {
  let reporter = new BaseReporter;
  let activity = reporter.activity();
  activity.tick();
  activity.end();
  reporter.close();
});

test("BaseReporter.question", (t) => {
  let reporter = new BaseReporter;
  t.throws(reporter.question());
  reporter.close();
});

test("BaseReporter.select", (t) => {
  let reporter = new BaseReporter;
  t.throws(reporter.select());
  reporter.close();
});

test("BaseReporter.progress", () => {
  let reporter = new BaseReporter;
  let tick = reporter.progress(1);
  tick();
  reporter.close();
});
