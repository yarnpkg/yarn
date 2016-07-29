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

import ProgressBar from "../../src/reporters/console/progress-bar.js";
import Spinner from "../../src/reporters/console/spinner.js";
import ConsoleReporter from "../../src/reporters/console/index.js";
import build from "./_mock.js";

let getConsoleBuff = build(ConsoleReporter, (data) => data);
let stream = require("stream");

test("ConsoleReporter.step", async () => {
  expect(await getConsoleBuff((r) => r.step(1, 5, "foboar"))).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[90m[1/5]\u001b[39m foboar..."
  });
});

test("ConsoleReporter.header", async () => {
  expect(await getConsoleBuff((r) => r.header("foobar", { name: "kpm", version: "0.0.0" }))).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[1mkpm foobar v0.0.0\u001b[22m"
  });
});

test("ConsoleReporter.footer", async () => {
  expect(await getConsoleBuff((r) => r.footer())).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1G✨  Done in 0.00s."
  });

  expect(await getConsoleBuff((r) => r.footer(true))).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1G✨  Done in 0.00s. Peak memory usage 0.00MB."
  });
});

test("ConsoleReporter.log", async () => {
  expect(await getConsoleBuff((r) => r.log("foobar"))).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1Gfoobar"
  });
});

test("ConsoleReporter.success", async () => {
  expect(await getConsoleBuff((r) => r.success("foobar"))).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[32msuccess\u001b[39m foobar"
  });
});

test("ConsoleReporter.error", async () => {
  expect(await getConsoleBuff((r) => r.error("foobar"))).toEqual({
    stderr: "\u001b[2K\u001b[1G\u001b[31merror\u001b[39m foobar",
    stdout: ""
  });
});

test("ConsoleReporter.info", async () => {
  expect(await getConsoleBuff((r) => r.info("foobar"))).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[34minfo\u001b[39m foobar"
  });
});

test("ConsoleReporter.command", async () => {
  expect(await getConsoleBuff((r) => r.command("foobar"))).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[90m$ foobar\u001b[39m"
  });
});

test("ConsoleReporter.warn", async () => {
  expect(await getConsoleBuff((r) => r.warn("foobar"))).toEqual({
    stderr: "\u001b[2K\u001b[1G\u001b[33mwarning\u001b[39m foobar",
    stdout: ""
  });
});

test("ConsoleReporter.activity", async () => {
  expect(await getConsoleBuff(function (r) {
    let activity = r.activity();
    activity.tick("foo");
    activity.end();
  })).toEqual({
    stderr: "\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G",
    stdout: ""
  });
});

test("ConsoleReporter.select", async () => {
  expect(await getConsoleBuff(async function (r, streams) {
    streams.stdin.on("resume", function () {
      streams.stdin.send("1\n", "ascii");
      streams.stdin.end();
    });

    let res = await r.select("Ayo", "Select one", ["foo", "bar"]);
    expect(res, "foo");
  })).toEqual({
    stderr: "",
    stdout: "\u001b[2K\u001b[1GAyo\n\u001b[2K\u001b[1G1. foo\n\u001b[2K\u001b[1G2. bar\n\u001b[1G\u001b[0JSelect one?: \u001b[14G1"
  });
});

test("ConsoleReporter.progress", async () => {
  expect(await getConsoleBuff(async function (r) {
    let tick = r.progress(2);
    tick();
    jest.runAllTimers();
    tick();
  })).toEqual({
    stderr: "\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2\u001b[2K\u001b[1G",
    stdout: ""
  });

  expect(await getConsoleBuff(async function (r) {
    let tick = r.progress(0);
    tick();
  })).toEqual({
    stderr: "",
    stdout: ""
  });

  expect(await getConsoleBuff(async function (r) {
    r.isTTY = false;
    let tick = r.progress(2);
    tick();
    tick();
  })).toEqual({
    stderr: "",
    stdout: ""
  });
});

test("ProgressBar", () => {
  let data = "";

  class TestStream extends stream.Writable {
    columns: number;
    constructor(options) {
      super(options);
      this.columns = 1000;
    }
    write(chunk: Buffer | string): boolean {
      data += String(chunk);
      return true;
    }
  }
  let bar = new ProgressBar(2, new TestStream());

  bar.render();
  expect(data).toBe("\u001b[2K\u001b[1G░░ 0/2");

  bar.tick();
  bar.render();
  expect(data).toBe("\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2");

  bar.tick();
  bar.render();
  expect(data).toBe("\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2\u001b[2K\u001b[1G\u001b[2K\u001b[1G██ 2/2");
});

test("Spinner", () => {
  let data = "";

  class TestStream extends stream.Writable {
    write(chunk: Buffer | string): boolean {
      data += String(chunk);
      return true;
    }
  }
  let spinner = new Spinner(new TestStream());

  spinner.start();
  expect(data).toBe("\u001b[2K\u001b[1G⠁ ");

  spinner.setText("foo");
  spinner.render();
  expect(data).toBe("\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo");

  spinner.setText("bar");
  spinner.render();
  expect(data).toBe("\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo\u001b[2K\u001b[1G⠄ bar");

  spinner.stop();
  expect(data).toBe("\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo\u001b[2K\u001b[1G⠄ bar\u001b[2K\u001b[1G");
});
