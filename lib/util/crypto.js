'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hash = hash;
const crypto = require('crypto');
const stream = require('stream');

function hash(content, type = 'md5') {
  return crypto.createHash(type).update(content).digest('hex');
}

class HashStream extends stream.Transform {
  constructor(options) {
    super(options);
    this._hash = crypto.createHash('sha1');
    this._updated = false;
  }

  _transform(chunk, encoding, callback) {
    this._updated = true;
    this._hash.update(chunk);
    callback(null, chunk);
  }

  getHash() {
    return this._hash.digest('hex');
  }

  test(sum) {
    return this._updated && sum === this.getHash();
  }
}
exports.HashStream = HashStream;