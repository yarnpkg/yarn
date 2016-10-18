/* @flow */

const Readable = require('stream').Readable;


export class StandinStdIn extends Readable {
  constructor(options: any) {
    super(options);
  }

  _read(size: number) {
    this.push(null);
  }
}
