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

export default class BufferReporter extends BaseReporter {
  constructor(opts: Object) {
    super(opts);
    this._buffer = [];
  }

  _buffer: Array<{
    type: string;
    data: string;
  }>;

  log(data: string) {
    this._buffer.push({ type: "log", data });
  }

  success(data: string) {
    this._buffer.push({ type: "success", data });
  }

  error(data: string) {
    this._buffer.push({ type: "error", data });
  }

  info(data: string) {
    this._buffer.push({ type: "info", data });
  }

  command(data: string) {
    this._buffer.push({ type: "command", data });
  }

  warn(data: string) {
    this._buffer.push({ type: "warning", data });
  }

  getBuffer(): Array<{
    type: string,
    data: string
  }> {
    return this._buffer;
  }
}
