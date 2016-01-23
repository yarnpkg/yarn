/* @flow */

import BaseReporter from "./_base";

export default class BufferReporter extends BaseReporter {
  constructor(opts: Object) {
    super(opts);
    this._buffer = [];
  }

  _buffer: Array<{
    type: string;
    data: string;
  }>;

  log(msg: string) {
    console.log(msg);
  }

  success(msg: string) {
    this._buffer.push({ type: "success", data: msg });
  }

  error(msg: string) {
    this._buffer.push({ type: "error", data: msg });
  }

  info(msg: string) {
    this._buffer.push({ type: "info", data: msg });
  }

  command(command: string) {
    this._buffer.push({ type: "command", data: command });
  }

  warn(msg: string) {
    this._buffer.push({ type: "warning", data: msg });
  }

  getBuffer(): Array<{
    type: string,
    data: string
  }> {
    return this._buffer;
  }
}
