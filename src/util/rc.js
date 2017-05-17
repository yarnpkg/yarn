/* @flow */

import {readFileSync} from 'fs';
import {basename, dirname, join} from 'path';

const etc = '/etc';
const isWin = process.platform === 'win32';
const home = isWin ? process.env.USERPROFILE : process.env.HOME;

export function findRc(name: string, parser: Function): Object {
  let configPaths = [];

  function addConfigPath(...segments) {
    configPaths.push(join(...segments));
  }

  function addRecursiveConfigPath(...segments) {
    const queue = [];

    let oldPath;
    let path = join(...segments);

    do {
      queue.unshift(path);

      oldPath = path;
      path = join(dirname(dirname(path)), basename(path));
    } while (path !== oldPath);

    configPaths = configPaths.concat(queue);
  }

  function fetchConfigs(): Object {
    return Object.assign(
      {},
      ...configPaths.map(path => {
        try {
          return parser(readFileSync(path).toString(), path);
        } catch (error) {
          return {};
        }
      }),
    );
  }

  if (!isWin) {
    addConfigPath(etc, name, 'config');
    addConfigPath(etc, `${name}rc`);
  }

  if (home) {
    addConfigPath(home, '.config', name, 'config');
    addConfigPath(home, '.config', name);
    addConfigPath(home, `.${name}`, 'config');
    addConfigPath(home, `.${name}rc`);
  }

  addRecursiveConfigPath(process.cwd(), `.${name}rc`);

  const envVariable = `${name}_config`.toUpperCase();

  if (process.env[envVariable]) {
    addConfigPath(process.env[envVariable]);
  }

  return fetchConfigs();
}
