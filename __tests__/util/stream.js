/* @flow */

import {ConcatStream} from '../../src/util/stream.js';

const fs = require('fs');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

test('ConcatStream', async function(): Promise<void> {
  const [actual, expected] = await Promise.all([
    new Promise((resolve, reject) => {
      fs.createReadStream(__filename).pipe(new ConcatStream(resolve)).on('error', reject);
    }),
    new Promise((resolve, reject) => {
      fs.readFile(__filename, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    }),
  ]);

  expect(Buffer.isBuffer(actual)).toBe(true);
  expect(Buffer.isBuffer(expected)).toBe(true);
  expect(actual.equals(expected)).toBe(true);
});
