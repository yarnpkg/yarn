const cp = require(`child_process`);

exports.execFile = function(...args) {
  return new Promise((resolve, reject) => {
    cp.execFile(...args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({stdout, stderr});
      }
    });
  });
};
