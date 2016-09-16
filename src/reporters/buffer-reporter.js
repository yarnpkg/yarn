/* @flow */

import JSONReporter from './json-reporter.js';

type Buffer = Array<{
  type: string,
  data: string | Object | number,
  error: boolean,
}>;

export default class BufferReporter extends JSONReporter {
  constructor(opts: Object) {
    super(opts);
    this._buffer = [];
  }

  _buffer: Buffer;

  _dump(type: string, data: any, error?: boolean) {
    this._buffer.push({
      type,
      data,
      error: !!error,
    });
  }

  getBuffer(): Buffer {
    return this._buffer;
  }
}
