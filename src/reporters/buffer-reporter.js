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
