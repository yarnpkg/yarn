/* @flow */

const Readable = require('stream').Readable;

export class StandinStdIn extends Readable {
  constructor() {
    super();
  }

  _read(size: number) {
    //do nothing
  }
}
