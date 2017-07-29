/* @flow */

import ROOT_USER from './root-user.js';

const path = require('path');

export const home = require('os').homedir();

const userHomeDir = process.platform === 'linux' && ROOT_USER ? path.resolve('/usr/local/share') : home;

export default userHomeDir;
