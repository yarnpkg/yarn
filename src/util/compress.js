/* @flow */

const invariant = require('invariant');
const stream = require('stream');
const zlib = require('zlib');

function hasGzipHeader(chunk: Buffer): boolean {
  return chunk[0] === 0x1F && chunk[1] === 0x8B && chunk[2] === 0x08;
}

type UnpackOptions = duplexStreamOptions;

export class UnpackStream extends stream.Transform {
  constructor(options?: UnpackOptions) {
    super(options);
    this._srcStream = null;
    this._readHeader = false;
    this.once('pipe', (src: stream.Readable) => {
      this._srcStream = src;
    });
  }

  _srcStream: ?stream.Readable;
  _readHeader: boolean;

  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: (error: ?Error, data?: Buffer | string) => void,
  ) {
    if (!this._readHeader) {
      this._readHeader = true;
      invariant(chunk instanceof Buffer, 'Chunk must be a buffer');
      if (hasGzipHeader(chunk)) {
        // Stop receiving data from the src stream, and pipe it instead to zlib,
        // then pipe it's output through us.
        const unzipStream = zlib.createUnzip();
        const srcStream = this._srcStream;
        invariant(srcStream, 'How? To get here a stream must have been piped!');
        srcStream
          .pipe(unzipStream)
          .pipe(this);
        // Unpipe after another stream has been piped so it's always piping to
        // something, thus avoiding pausing it.
        srcStream.unpipe(this);
        unzipStream.write(chunk);
        this._srcStream = null;
        callback();
        return;
      }
    }
    callback(null, chunk);
  }
}
