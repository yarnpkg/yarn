/* @flow */

import ROOT_USER from './root-user.js';

import os from 'os';
import path from 'path';

const userHomeDir = (process.platform === 'linux' && ROOT_USER) ?
  path.resolve('/usr/local/share') :
  os.homedir();

export default userHomeDir;
