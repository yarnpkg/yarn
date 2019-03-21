'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.examples = exports.setFlags = exports.run = exports.runScript = exports.info = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let info = exports.info = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const workspaceRootFolder = config.workspaceRootFolder;


    if (!workspaceRootFolder) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('workspaceRootNotFound', config.cwd));
    }

    const manifest = yield config.findManifest(workspaceRootFolder, false);
    invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

    const workspaces = yield config.resolveWorkspaces(workspaceRootFolder, manifest);

    const publicData = {};

    for (var _iterator = Object.keys(workspaces), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref2 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref2 = _i.value;
      }

      const workspaceName = _ref2;
      var _workspaces$workspace = workspaces[workspaceName];
      const loc = _workspaces$workspace.loc,
            manifest = _workspaces$workspace.manifest;


      const workspaceDependencies = new Set();
      const mismatchedWorkspaceDependencies = new Set();

      for (var _iterator2 = (_constants || _load_constants()).DEPENDENCY_TYPES, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const dependencyType = _ref3;

        if (dependencyType !== 'peerDependencies') {
          for (var _iterator3 = Object.keys(manifest[dependencyType] || {}), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
            var _ref4;

            if (_isArray3) {
              if (_i3 >= _iterator3.length) break;
              _ref4 = _iterator3[_i3++];
            } else {
              _i3 = _iterator3.next();
              if (_i3.done) break;
              _ref4 = _i3.value;
            }

            const dependencyName = _ref4;

            if (Object.prototype.hasOwnProperty.call(workspaces, dependencyName)) {
              invariant(manifest && manifest[dependencyType], 'The request should exist');
              const requestedRange = manifest[dependencyType][dependencyName];
              if (semver.satisfies(workspaces[dependencyName].manifest.version, requestedRange)) {
                workspaceDependencies.add(dependencyName);
              } else {
                mismatchedWorkspaceDependencies.add(dependencyName);
              }
            }
          }
        }
      }

      publicData[workspaceName] = {
        location: path.relative(config.lockfileFolder, loc).replace(/\\/g, '/'),
        workspaceDependencies: Array.from(workspaceDependencies),
        mismatchedWorkspaceDependencies: Array.from(mismatchedWorkspaceDependencies)
      };
    }

    reporter.log(JSON.stringify(publicData, null, 2), { force: true });
  });

  return function info(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let runScript = exports.runScript = (() => {
  var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const workspaceRootFolder = config.workspaceRootFolder;


    if (!workspaceRootFolder) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('workspaceRootNotFound', config.cwd));
    }

    const manifest = yield config.findManifest(workspaceRootFolder, false);
    invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

    const workspaces = yield config.resolveWorkspaces(workspaceRootFolder, manifest);

    try {
      var _ref6 = flags.originalArgs || [];

      const _ = _ref6[0],
            rest = _ref6.slice(1);

      for (var _iterator4 = Object.keys(workspaces), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref7;

        if (_isArray4) {
          if (_i4 >= _iterator4.length) break;
          _ref7 = _iterator4[_i4++];
        } else {
          _i4 = _iterator4.next();
          if (_i4.done) break;
          _ref7 = _i4.value;
        }

        const workspaceName = _ref7;
        const loc = workspaces[workspaceName].loc;


        yield (_child || _load_child()).spawn((_constants2 || _load_constants2()).NODE_BIN_PATH, [(_constants2 || _load_constants2()).YARN_BIN_PATH, ...rest], {
          stdio: 'inherit',
          cwd: loc
        });
      }
    } catch (err) {
      throw err;
    }
  });

  return function runScript(_x5, _x6, _x7, _x8) {
    return _ref5.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _buildSubCommands2;

function _load_buildSubCommands() {
  return _buildSubCommands2 = _interopRequireDefault(require('./_build-sub-commands.js'));
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants.js');
}

var _child;

function _load_child() {
  return _child = _interopRequireWildcard(require('../../util/child.js'));
}

var _constants2;

function _load_constants2() {
  return _constants2 = require('../../constants');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');
const path = require('path');
const semver = require('semver');

function hasWrapper(commander, args) {
  return true;
}

var _buildSubCommands = (0, (_buildSubCommands2 || _load_buildSubCommands()).default)('workspaces', {
  info(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield info(config, reporter, flags, args);
    })();
  },
  run(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield runScript(config, reporter, flags, args);
    })();
  }
});

const run = _buildSubCommands.run,
      setFlags = _buildSubCommands.setFlags,
      examples = _buildSubCommands.examples;
exports.run = run;
exports.setFlags = setFlags;
exports.examples = examples;