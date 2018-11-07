var fs = require('fs');
fs.appendFileSync('log.js', 'module.exports.push("install");', 'utf8');