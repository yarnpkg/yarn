'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawn = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _path;

function _load_path() {
  return _path = _interopRequireDefault(require('path'));
}

var _child;

function _load_child() {
  return _child = _interopRequireWildcard(require('../child.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const BATCH_MODE_ARGS = new Map([['ssh', '-oBatchMode=yes'], ['plink', '-batch']]);

// Suppress any password prompts since we run these in the background
const env = (0, (_extends2 || _load_extends()).default)({
  GIT_ASKPASS: '',
  GIT_TERMINAL_PROMPT: 0
}, process.env);

const sshCommand = env.GIT_SSH || 'ssh';
const sshExecutable = (_path || _load_path()).default.basename(sshCommand.toLowerCase(), '.exe');
const sshBatchArgs = BATCH_MODE_ARGS.get(sshExecutable);

if (!env.GIT_SSH_COMMAND && sshBatchArgs) {
  // We have to manually specify `GIT_SSH_VARIANT`,
  // because it's not automatically set when using `GIT_SSH_COMMAND` instead of `GIT_SSH`
  // See: https://github.com/yarnpkg/yarn/issues/4729
  env.GIT_SSH_VARIANT = sshExecutable;
  env.GIT_SSH_COMMAND = `"${sshCommand}" ${sshBatchArgs}`;
}

const spawn = exports.spawn = (args, opts = {}) => {
  return (_child || _load_child()).spawn('git', args, (0, (_extends2 || _load_extends()).default)({}, opts, { env }));
};