/* @flow */

const cp = require('child_process');

exports.execFile = function(
  path: string,
  args: Array<string>,
  options: Object,
): Promise<{|stdout: Buffer, stderr: Buffer|}> {
  return new Promise((resolve, reject) => {
    cp.execFile(path, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        stdout = stdout.replace(/\r\n?/g, `\n`);
        stderr = stderr.replace(/\r\n?/g, `\n`);
        resolve({stdout, stderr});
      }
    });
  });
};
