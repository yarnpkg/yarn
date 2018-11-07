var fs = require('fs');
fs.appendFileSync('log.js', 'module.exports.push("postinstall");', 'utf8');

var fs = require('fs');
fs.appendFileSync('rnd.js', `module.exports = ${Math.floor(Math.random() * 512000)};`, 'utf8');