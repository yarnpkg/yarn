var fs = require('fs');
fs.writeFileSync('dummy.txt', 'foobar');
fs.mkdirSync('dummy');
fs.writeFileSync('dummy/dummy.txt', 'foobar');
