const fs = require(`fs`);

fs.appendFileSync(`${__dirname}/../log.js`, `module.exports.push('postinstall');`);
fs.appendFileSync(`${__dirname}/../rnd.js`, `module.exports = ${Math.floor(Math.random() * 512000)};`);
