/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

let Stdin = require("mock-stdin").stdin.Class;
let { Writable } = require("stream");

export default function (Reporter: Function, interceptor: Function) {
  return async function (callback) {
    let data = {
      stderr: [],
      stdout: []
    };

    let buildStream = (arr) => {
      let stream = new Writable;
      stream.columns = 1000;
      stream.write = (msg) => {
        stream.emit("data", msg);
        msg = msg.trim();
        if (msg) arr.push(msg);
      };
      return stream;
    };

    let streams = {
      stdin: new Stdin,
      stdout: buildStream(data.stdout),
      stderr: buildStream(data.stderr),
    };

    let reporter = new Reporter(streams);

    reporter.peakMemory = 0;
    reporter.isTTY = true;
    reporter.getTotalTime = () => 0;

    await callback(reporter, streams);
    reporter.close();
    return interceptor(data, reporter);
  };
}
