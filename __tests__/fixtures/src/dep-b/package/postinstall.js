const fs = require('fs');

if (!fs.existsSync('../dep-c/dep-c-built')) {
  process.exit(1);
} else {
  fs.openSync('dep-b-built', 'w');
}
