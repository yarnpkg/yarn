/* @flow */

import {readFileSync} from 'fs';
import * as path from 'path';

const etc = '/etc';
const isWin = process.platform === 'win32';
const home = isWin ? process.env.USERPROFILE : process.env.HOME;

function getRcPaths(name: string, cwd: string): Array<string> {
  const configPaths = [];

  function addConfigPath(...segments) {
    configPaths.push(path.join(...segments));
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

  // add .yarnrc locations relative to the cwd
  while (true) {
    configPaths.unshift(path.join(cwd, `.${name}rc`));

    const upperCwd = path.dirname(cwd);
    if (upperCwd === cwd) {
      // we've reached the root
      break;
    } else {
      // continue since there's still more directories to search
      cwd = upperCwd;
    }
  }

  const envVariable = `${name}_config`.toUpperCase();

  if (process.env[envVariable]) {
    addConfigPath(process.env[envVariable]);
  }

  return configPaths;
}

function parseRcPaths(paths: Array<string>, parser: Function): Object {
  return Object.assign(
    {},
    ...paths.map(path => {
      try {
        return parser(readFileSync(path).toString(), path);
      } catch (error) {
        return {};
      }
    }),
  );
}

export function findRc(name: string, cwd: string, parser: Function): Object {
  return parseRcPaths(getRcPaths(name, cwd), parser);
}
