const fs = require(`fs`);

fs.appendFileSync(`${__dirname}/../log.js`, `module.exports.push('preinstall');`);
