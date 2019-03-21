'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.home = undefined;

var _rootUser;

function _load_rootUser() {
  return _rootUser = _interopRequireDefault(require('./root-user.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

const home = exports.home = require('os').homedir();

const userHomeDir = (_rootUser || _load_rootUser()).default ? path.resolve('/usr/local/share') : home;

exports.default = userHomeDir;