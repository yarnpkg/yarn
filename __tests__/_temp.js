/* @flow */

const temp = require('temp');

export default function(filename?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    temp.mkdir(filename, function(err, path) {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}
