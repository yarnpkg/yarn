/* @flow */

module.exports = require(`./package.json`);

for (const key of Object.keys(module.exports.dependencies || {})) {
  // $FlowFixMe The whole point of this file is to be dynamic
  module.exports.dependencies[key] = require(key);
}
