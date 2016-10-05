const fs = require('fs');

if (!fs.existsSync('../dep-b/dep-b-built')) {
  process.exit(1);
} else {
  fs.openSync('dep-a-built', 'w');
}
