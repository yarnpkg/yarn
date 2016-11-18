var fs = require('fs');
fs.writeFileSync('dummy.txt', 'foobar');
if (!fs.existsSync('dummy')) {
  fs.mkdirSync('dummy');
}
fs.writeFileSync('dummy/dummy.txt', 'foobar');
