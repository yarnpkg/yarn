/* @flow */

const through = require('through2');
const crypto = require('crypto');

export function hash(content: string, type: string = 'md5'): string {
  return crypto.createHash(type).update(content).digest('hex');
}

declare class HashStream extends stream$Readable {
  getHash: () => string,
  test: (sum: string) => boolean,
}
export type {HashStream};

export function hashStreamValidation(): HashStream {
  const hash = crypto.createHash('sha1');
  let updated = false;

  const validationStream = through(function(chunk, enc, done) {
    updated = true;
    hash.update(chunk);
    done(null, chunk);
  });

  validationStream.getHash = (): string => hash.digest('hex');

  validationStream.test = (sum): boolean => updated && sum === validationStream.getHash();

  return validationStream;
}
