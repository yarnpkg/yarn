var fs = require('fs');
fs.appendFileSync('log.js', 'module.exports.push("preinstall");', 'utf8');
