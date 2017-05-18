const fs = require('fs');

if (!fs.existsSync('dep-a-built')) {
  fs.symlinkSync('index.js', 'link-index.js', 'file');
}
