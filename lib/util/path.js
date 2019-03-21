'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPosixPath = getPosixPath;
exports.resolveWithHome = resolveWithHome;

var _path;

function _load_path() {
  return _path = require('path');
}

const userHome = require('./user-home-dir').default;

function getPosixPath(path) {
  return path.replace(/\\/g, '/');
}

function resolveWithHome(path) {
  const homePattern = process.platform === 'win32' ? /^~(\/|\\)/ : /^~\//;
  if (homePattern.test(path)) {
    return (0, (_path || _load_path()).resolve)(userHome, path.substr(2));
  }

  return (0, (_path || _load_path()).resolve)(path);
}