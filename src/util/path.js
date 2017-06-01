/* @flow */

const userHome = require('./user-home-dir').default;

export function expandPath(path: string): string {
  if (process.platform !== 'win32') {
    path = path.replace(/^\s*~(?=$|\/|\\)/, userHome);
  }

  return path;
}
