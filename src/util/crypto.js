/* @flow */

let through = require("through2");
let crypto  = require("crypto");

export function hash(content: string, type: string = "md5"): string {
  // $FlowFixMe: this is never possibly undefined?
  return crypto.createHash(type).update(content).digest("hex");
}

export function hashStreamValidation(): {
  getHash: () => string,
  test: (sum: string) => boolean;
} {
  let hash = crypto.createHash("sha1");
  let updated = false;

  let validationStream = through(function (chunk, enc, done) {
    updated = true;
    hash.update(chunk);
    done(null, chunk)
  });

  validationStream.getHash = () => hash.digest("hex");

  validationStream.test = sum => updated && sum === validationStream.getHash();

  return validationStream;
}
