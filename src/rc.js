/* @flow */

import parse from './lockfile/parse.js';

const rc = require('rc');

// Keys that will get resolved relative to the path of the rc file they belong to
const PATH_KEYS = [
  'cache-folder',
  'global-folder',
  'modules-folder',
];

let rcConfCache;
let rcArgsCache;

const buildRcConf = () => rc('yarn', {}, [], (fileText) => {
  const values = parse(fileText, 'yarnrc');
  const keys = Object.keys(values);

  // Unfortunately, the "rc" module we use doesn't tell us the file path :(
  // cf https://github.com/dominictarr/rc/issues/61

  for (const key of keys) {
    for (const pathKey of PATH_KEYS) {
      if (key.replace(/^(--)?([^.]+\.)+/, '') === pathKey) {
        // values[key] = resolve(dirname(filePath), values[key]);
        if (!values[key].startsWith('/')) {
          delete values[keys];
        }
      }
    }
  }

  return values;
});

export function getRcConf(): { [string]: Array<string> } {
  if (!rcConfCache) {
    rcConfCache = buildRcConf();
  }

  return rcConfCache;
}

const buildRcArgs = () => Object.keys(getRcConf()).reduce((argLists, key) => {
  const miniparse = key.match(/^--(?:([^.]+)\.)?(.*)$/);

  if (!miniparse) {
    return argLists;
  }

  const namespace = miniparse[1] || '*';
  const arg = miniparse[2];
  const value = getRcConf()[key];

  if (!argLists[namespace]) {
    argLists[namespace] = [];
  }

  if (typeof value === 'string') {
    argLists[namespace] = argLists[namespace].concat([`--${arg}`, value]);
  } else if (value === true) {
    argLists[namespace] = argLists[namespace].concat([`--${arg}`]);
  } else if (value === false) {
    argLists[namespace] = argLists[namespace].concat([`--no-${arg}`]);
  }

  return argLists;
}, {});

export function getRcArgs(command: string): Array<string> {
  if (!rcArgsCache) {
    rcArgsCache = buildRcArgs();
  }

  let result = rcArgsCache['*'] || [];

  if (command !== '*') {
    result = result.concat(rcArgsCache[command] || []);
  }

  return result;
}

export function clearRcCache() {
  rcConfCache = null;
  rcArgsCache = null;
}
