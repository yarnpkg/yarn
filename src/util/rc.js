/* @flow */

import {readFileSync} from 'fs';
import * as path from 'path';
import {CONFIG_DIRECTORY} from '../constants';

const etc = '/etc';
const isWin = process.platform === 'win32';
const home = isWin ? process.env.USERPROFILE : process.env.HOME;

function getRcPaths(name: string, cwd: string): Array<string> {
  const configPaths = [];

  function pushConfigPath(...segments) {
    configPaths.push(path.join(...segments));
    if (segments[segments.length - 1] === `.${name}rc`) {
      configPaths.push(path.join(...segments.slice(0, -1), `.${name}rc.yml`));
    }
  }

  function unshiftConfigPath(...segments) {
    if (segments[segments.length - 1] === `.${name}rc`) {
      configPaths.unshift(path.join(...segments.slice(0, -1), `.${name}rc.yml`));
    }
    configPaths.unshift(path.join(...segments));
  }

  if (!isWin) {
    pushConfigPath(etc, name, 'config');
    pushConfigPath(etc, `${name}rc`);
  }

  if (home) {
    pushConfigPath(CONFIG_DIRECTORY);
    pushConfigPath(home, '.config', name, 'config');
    pushConfigPath(home, '.config', name);
    pushConfigPath(home, `.${name}`, 'config');
    pushConfigPath(home, `.${name}rc`);
  }

  // add .yarnrc locations relative to the cwd
  while (true) {
    unshiftConfigPath(cwd, `.${name}rc`);

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
    pushConfigPath(process.env[envVariable]);
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
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
          return {};
        } else {
          throw error;
        }
      }
    }),
  );
}

export function findRc(name: string, cwd: string, parser: Function): Object {
  return parseRcPaths(getRcPaths(name, cwd), parser);
}
