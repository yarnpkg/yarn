'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const pnpPath = `${config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`;

    let nodeOptions = process.env.NODE_OPTIONS || '';
    if (yield (_fs || _load_fs()).exists(pnpPath)) {
      nodeOptions = `--require ${pnpPath} ${nodeOptions}`;
    }

    try {
      yield (_child || _load_child()).spawn((_constants || _load_constants()).NODE_BIN_PATH, args, {
        stdio: 'inherit',
        cwd: flags.into || config.cwd,
        env: (0, (_extends2 || _load_extends()).default)({}, process.env, { NODE_OPTIONS: nodeOptions })
      });
    } catch (err) {
      throw err;
    }
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _child;

function _load_child() {
  return _child = _interopRequireWildcard(require('../../util/child.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function setFlags(commander) {
  commander.description('Runs Node with the same version that the one used by Yarn itself, and by default from the project root');
  commander.usage('node [--into PATH] [... args]');
  commander.option('--into <path>', 'Sets the cwd to the specified location');
}

function hasWrapper(commander, args) {
  return true;
}