'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findRc = findRc;

var _fs;

function _load_fs() {
  return _fs = require('fs');
}

var _path;

function _load_path() {
  return _path = _interopRequireWildcard(require('path'));
}

var _constants;

function _load_constants() {
  return _constants = require('../constants');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const etc = '/etc';

const isWin = process.platform === 'win32';
const home = isWin ? process.env.USERPROFILE : process.env.HOME;

function getRcPaths(name, cwd) {
  const configPaths = [];

  function addConfigPath(...segments) {
    configPaths.push((_path || _load_path()).join(...segments));
  }

  if (!isWin) {
    addConfigPath(etc, name, 'config');
    addConfigPath(etc, `${name}rc`);
  }

  if (home) {
    addConfigPath((_constants || _load_constants()).CONFIG_DIRECTORY);
    addConfigPath(home, '.config', name, 'config');
    addConfigPath(home, '.config', name);
    addConfigPath(home, `.${name}`, 'config');
    addConfigPath(home, `.${name}rc`);
  }

  // add .yarnrc locations relative to the cwd
  while (true) {
    configPaths.unshift((_path || _load_path()).join(cwd, `.${name}rc`));

    const upperCwd = (_path || _load_path()).dirname(cwd);
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

function parseRcPaths(paths, parser) {
  return Object.assign({}, ...paths.map(path => {
    try {
      return parser((0, (_fs || _load_fs()).readFileSync)(path).toString(), path);
    } catch (error) {
      return {};
    }
  }));
}

function findRc(name, cwd, parser) {
  return parseRcPaths(getRcPaths(name, cwd), parser);
}