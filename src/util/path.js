/* @flow */

const userHome = require('./user-home-dir').default;

export function getPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function expandPath(path: string): string {
  if (process.platform !== 'win32') {
    path = path.replace(/^\s*~(?=$|\/|\\)/, userHome);
  }

  return path;
}
