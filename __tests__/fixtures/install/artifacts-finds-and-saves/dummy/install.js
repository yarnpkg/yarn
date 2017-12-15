const fs = require('fs');
const util = require('util');

const thrower = (err) => {
  if (err) {
    throw err;
  }
};

fs.writeFile('dummy.txt', 'foobar', thrower);
fs.mkdir('dummy', err => {
  if (err && err.code !== 'EEXIST')
    throw err;
  fs.writeFile('dummy/dummy.txt', 'foobar', thrower)
});
