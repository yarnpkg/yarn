/* @flow */

import ROOT_USER from './root-user.js';

const path = require('path');

const userHomeDir = process.platform === 'linux' && ROOT_USER
  ? path.resolve('/usr/local/share')
  : require('os').homedir();

export default userHomeDir;
