/* @flow */
const path = require('path');
const {ROOT_USER} = require('../constants');

const userHomeDir = (process.platform === 'linux' && ROOT_USER) ?
  path.resolve('/usr/local/share') :
  require('os').homedir();

export default userHomeDir;
