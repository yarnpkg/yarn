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

import BaseReporter from "./_base.js";

export default class JSONReporter extends BaseReporter {
  constructor(opts?: Object) {
    super(opts);

    this._activityId = 0;
    this._progressId = 0;
  }

  _activityId: number;
  _progressId: number;

  _dump(type: string, data: any, error?: boolean) {
    let stdout = this.stdout;
    if (error) stdout = this.stderr;
    stdout.write(`${JSON.stringify({ type, data })}\n`);
  }

  step(current: number, total: number, message: string) {
    this._dump("step", { message, current, total });
  }

  footer() {
    this._dump("finished", this.getTotalTime());
  }

  log(msg: string) {
    this._dump("log", msg);
  }

  command(msg: string) {
    this._dump("command", msg);
  }

  success(msg: string) {
    this._dump("success", msg);
  }

  error(msg: string) {
    this._dump("error", msg, true);
  }

  warn(msg: string) {
    this._dump("warning", msg, true);
  }

  info(msg: string) {
    this._dump("info", msg);
  }

  activity(): {
    tick: (name: string) => void,
    end: () => void
  } {
    let id = this._activityId++;
    this._dump("activityStart", { id });

    return {
      tick: (name: string) => {
        this._dump("activitytick", { id, name });
      },

      end: () => {
        this._dump("activityEnd", { id });
      }
    };
  }

  progress(total: number): Function {
    let id = this._progressId++;
    let current = 0;
    this._dump("progressStart", { id, total });

    return () => {
      current++;
      this._dump("progressTick", { id, current });

      if (current === total) {
        this._dump("progressFinish", { id });
      }
    };
  }
}
