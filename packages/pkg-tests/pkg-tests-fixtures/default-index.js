/* @flow */

module.exports = require(`./package.json`);

for (const key of [`dependencies`, `devDependencies`, `peerDependencies`]) {
  for (const dep of Object.keys(module.exports[key] || {})) {
    // $FlowFixMe The whole point of this file is to be dynamic
    module.exports[key][dep] = require(dep);
  }
}
