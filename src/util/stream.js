/* @flow */

const invariant = require('invariant');
const stream = require('stream');

export class ConcatStream extends stream.Transform {
  constructor(done: (buf: Buffer) => void) {
    super();
    this._data = [];
    this._done = done;
  }

  _data: ?Array<Buffer>;
  _done: (buf: Buffer) => void;

  _transform(chunk: Buffer | string, encoding: string, callback: (error: ?Error, data?: Buffer | string) => void) {
    invariant(chunk instanceof Buffer, 'Chunk must be a buffer');
    invariant(this._data != null, 'Missing data array');
    this._data.push(chunk);
    this.push(chunk);
    callback();
  }

  _flush(callback: (error: ?Error) => void) {
    invariant(this._data != null, 'Missing data array');
    this._done(Buffer.concat(this._data));
    this._data = null;
    callback();
  }
}
