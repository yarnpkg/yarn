module.exports = require(`./package.json`);

for (const key of Object.keys(module.exports.dependencies || {})) {
  module.exports.dependencies[key] = require(key);
}
