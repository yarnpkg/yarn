'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getRcConfigForCwd = getRcConfigForCwd;
exports.getRcArgs = getRcArgs;

var _fs;

function _load_fs() {
  return _fs = require('fs');
}

var _path;

function _load_path() {
  return _path = require('path');
}

var _commander;

function _load_commander() {
  return _commander = _interopRequireDefault(require('commander'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = require('./lockfile');
}

var _rc;

function _load_rc() {
  return _rc = _interopRequireWildcard(require('./util/rc.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Keys that will get resolved relative to the path of the rc file they belong to
const PATH_KEYS = new Set(['yarn-path', 'cache-folder', 'global-folder', 'modules-folder', 'cwd', 'offline-cache-folder']);

// given a cwd, load all .yarnrc files relative to it


function getRcConfigForCwd(cwd, args) {
  const config = {};

  if (args.indexOf('--no-default-rc') === -1) {
    Object.assign(config, (_rc || _load_rc()).findRc('yarn', cwd, (fileText, filePath) => {
      return loadRcFile(fileText, filePath);
    }));
  }

  for (let index = args.indexOf('--use-yarnrc'); index !== -1; index = args.indexOf('--use-yarnrc', index + 1)) {
    const value = args[index + 1];

    if (value && value.charAt(0) !== '-') {
      Object.assign(config, loadRcFile((0, (_fs || _load_fs()).readFileSync)(value).toString(), value));
    }
  }

  return config;
}

function loadRcFile(fileText, filePath) {
  var _parse = (0, (_lockfile || _load_lockfile()).parse)(fileText, 'yarnrc');

  const values = _parse.object;

  // some keys reference directories so keep their relativity

  for (const key in values) {
    if (PATH_KEYS.has(key.replace(/^(--)?([^.]+\.)*/, ''))) {
      values[key] = (0, (_path || _load_path()).resolve)((0, (_path || _load_path()).dirname)(filePath), values[key]);
    }
  }

  return values;
}

// get the built of arguments of a .yarnrc chain of the passed cwd
function buildRcArgs(cwd, args) {
  const config = getRcConfigForCwd(cwd, args);

  const argsForCommands = new Map();

  for (const key in config) {
    // args can be prefixed with the command name they're meant for, eg.
    // `--install.check-files true`
    const keyMatch = key.match(/^--(?:([^.]+)\.)?(.*)$/);
    if (!keyMatch) {
      continue;
    }

    const commandName = keyMatch[1] || '*';
    const arg = keyMatch[2];
    const value = config[key];

    // create args for this command name if we didn't previously have them
    const args = argsForCommands.get(commandName) || [];
    argsForCommands.set(commandName, args);

    // turn config value into appropriate cli flag
    const option = (_commander || _load_commander()).default.optionFor(`--${arg}`);

    // If commander doesn't recognize the option or it takes a value after it
    if (!option || option.optional || option.required) {
      args.push(`--${arg}`, value);
    } else if (value === true) {
      // we can't force remove an arg from cli
      args.push(`--${arg}`);
    }
  }

  return argsForCommands;
}

// extract the value of a --cwd arg if present
function extractCwdArg(args) {
  for (let i = 0, I = args.length; i < I; ++i) {
    const arg = args[i];
    if (arg === '--') {
      return null;
    } else if (arg === '--cwd') {
      return args[i + 1];
    }
  }
  return null;
}

// get a list of arguments from .yarnrc that apply to this commandName
function getRcArgs(commandName, args, previousCwds = []) {
  // for the cwd, use the --cwd arg if it was passed or else use process.cwd()
  const origCwd = extractCwdArg(args) || process.cwd();

  // get a map of command names and their arguments
  const argMap = buildRcArgs(origCwd, args);

  // concat wildcard arguments and arguments meant for this specific command
  const newArgs = [...(argMap.get('*') || []), ...(argMap.get(commandName) || [])];

  // check if the .yarnrc args specified a cwd
  const newCwd = extractCwdArg(newArgs);
  if (newCwd && newCwd !== origCwd) {
    // ensure that we don't enter into a loop
    if (previousCwds.indexOf(newCwd) !== -1) {
      throw new Error(`Recursive .yarnrc files specifying --cwd flags. Bailing out.`);
    }

    //  if we have a new cwd then let's refetch the .yarnrc args relative to it
    return getRcArgs(commandName, newArgs, previousCwds.concat(origCwd));
  }

  return newArgs;
}