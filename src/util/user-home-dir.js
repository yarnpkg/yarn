/* @flow */

import ROOT_USER from './root-user.js';

const path = require('path');

const isNotFakeRoot = typeof process.env.FAKEROOTKEY === 'undefined';

const userHomeDir =
  process.platform === 'linux' && ROOT_USER && isNotFakeRoot
    ? path.resolve('/usr/local/share')
    : require('os').homedir();

export default userHomeDir;
