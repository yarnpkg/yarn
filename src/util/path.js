/* @flow */

import {resolve} from 'path';

const userHome = require('./user-home-dir').default;

export function getPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function resolveWithHome(path: string): string {
  const homePattern = process.platform === 'win32' ? /^~(\/|\\)/ : /^~\//;
  if (homePattern.test(path)) {
    return resolve(userHome, path.substr(2));
  }

  return resolve(path);
}
