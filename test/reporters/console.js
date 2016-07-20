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

import ProgressBar from "../../lib/reporters/console/progress-bar.js";
import Spinner from "../../lib/reporters/console/spinner.js";
import ConsoleReporter from "../../lib/reporters/console/index.js";
import build from "./_mock.js";

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let test = require("ava");

let getConsoleBuff = build(ConsoleReporter, (data) => data);

test("ConsoleReporter.step", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.step(1, 5, "foboar")), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[90m[1/5]\u001b[39m foboar..."
  });
});

test("ConsoleReporter.header", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.header("foobar", { name: "kpm", version: "0.0.0" })), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[1mkpm foobar v0.0.0\u001b[22m"
  });
});

test("ConsoleReporter.footer", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.footer()), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1G✨  Done in 0.00s."
  });

  t.deepEqual(await getConsoleBuff((r) => r.footer(true)), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1G✨  Done in 0.00s. Peak memory usage 0.00MB."
  });
});

test("ConsoleReporter.log", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.log("foobar")), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1Gfoobar"
  });
});

test("ConsoleReporter.success", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.success("foobar")), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[32msuccess\u001b[39m foobar"
  });
});

test("ConsoleReporter.error", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.error("foobar")), {
    stderr: "\u001b[2K\u001b[1G\u001b[31merror\u001b[39m foobar",
    stdout: ""
  });
});

test("ConsoleReporter.info", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.info("foobar")), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[34minfo\u001b[39m foobar"
  });
});

test("ConsoleReporter.command", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.command("foobar")), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1G\u001b[90m$ foobar\u001b[39m"
  });
});

test("ConsoleReporter.warn", async (t) => {
  t.deepEqual(await getConsoleBuff((r) => r.warn("foobar")), {
    stderr: "\u001b[2K\u001b[1G\u001b[33mwarning\u001b[39m foobar",
    stdout: ""
  });
});

test("ConsoleReporter.activity", async (t) => {
  t.deepEqual(await getConsoleBuff(function (r) {
    let activity = r.activity();
    activity.tick("foo");
    activity.end();
  }), {
    stderr: "\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G",
    stdout: ""
  });
});

test("ConsoleReporter.select", async (t) => {
  t.deepEqual(await getConsoleBuff(async function (r, streams) {
    streams.stdin.on("resume", function () {
      streams.stdin.send("1\n", "ascii");
      streams.stdin.end();
    });

    let res = await r.select("Ayo", "Select one", ["foo", "bar"]);
    t.deepEqual(res, "foo");
  }), {
    stderr: "",
    stdout: "\u001b[2K\u001b[1GAyo\n\u001b[2K\u001b[1G1. foo\n\u001b[2K\u001b[1G2. bar\n\u001b[1G\u001b[0JSelect one?: \u001b[14G1"
  });
});

test("ConsoleReporter.progress", async (t) => {
  t.deepEqual(await getConsoleBuff(async function (r) {
    let tick = r.progress(2);
    tick();
    await wait(1000);
    tick();
  }), {
    stderr: "\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2\u001b[2K\u001b[1G",
    stdout: ""
  });

  t.deepEqual(await getConsoleBuff(async function (r) {
    let tick = r.progress(0);
    tick();
  }), {
    stderr: "",
    stdout: ""
  });

  t.deepEqual(await getConsoleBuff(async function (r) {
    r.isTTY = false;
    let tick = r.progress(2);
    tick();
    tick();
  }), {
    stderr: "",
    stdout: ""
  });
});

test("ProgressBar", (t) => {
  let data = "";

  let bar = new ProgressBar(2, {
    columns: 1000,
    write(msg) {
      data += msg;
    }
  });

  bar.render();
  t.is(data, "\u001b[2K\u001b[1G░░ 0/2");

  bar.tick();
  bar.render();
  t.is(data, "\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2");

  bar.tick();
  bar.render();
  t.is(data, "\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2\u001b[2K\u001b[1G\u001b[2K\u001b[1G██ 2/2");
});

test("Spinner", (t) => {
  let data = "";

  let spinner = new Spinner({
    write(msg) {
      data += msg;
    }
  });

  spinner.start();
  t.is(data, "\u001b[2K\u001b[1G⠁ ");

  spinner.setText("foo");
  spinner.render();
  t.is(data, "\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo");

  spinner.setText("bar");
  spinner.render();
  t.is(data, "\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo\u001b[2K\u001b[1G⠄ bar");

  spinner.stop();
  t.is(data, "\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo\u001b[2K\u001b[1G⠄ bar\u001b[2K\u001b[1G");
});
