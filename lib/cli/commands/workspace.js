'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const workspaceRootFolder = config.workspaceRootFolder;


    if (!workspaceRootFolder) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('workspaceRootNotFound', config.cwd));
    }

    if (flags.originalArgs < 1) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('workspaceMissingWorkspace'));
    }

    if (flags.originalArgs < 2) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('workspaceMissingCommand'));
    }

    const manifest = yield config.findManifest(workspaceRootFolder, false);
    invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

    const workspaces = yield config.resolveWorkspaces(workspaceRootFolder, manifest);

    var _ref2 = flags.originalArgs || [];

    const workspaceName = _ref2[0],
          rest = _ref2.slice(1);

    if (!Object.prototype.hasOwnProperty.call(workspaces, workspaceName)) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('workspaceUnknownWorkspace', workspaceName));
    }

    const workspace = workspaces[workspaceName];

    try {
      yield (_child || _load_child()).spawn((_constants || _load_constants()).NODE_BIN_PATH, [(_constants || _load_constants()).YARN_BIN_PATH, ...rest], {
        stdio: 'inherit',
        cwd: workspace.loc
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

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _child;

function _load_child() {
  return _child = _interopRequireWildcard(require('../../util/child.js'));
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

function setFlags(commander) {}

function hasWrapper(commander, args) {
  return true;
}