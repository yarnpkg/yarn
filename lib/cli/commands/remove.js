'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.requireLockfile = undefined;

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
    const isWorkspaceRoot = config.workspaceRootFolder && config.cwd === config.workspaceRootFolder;

    if (!args.length) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('tooFewArguments', 1));
    }

    // running "yarn remove something" in a workspace root is often a mistake
    if (isWorkspaceRoot && !flags.ignoreWorkspaceRootCheck) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('workspacesRemoveRootCheck'));
    }

    const totalSteps = args.length + 1;
    let step = 0;

    // load manifests
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder);
    const rootManifests = yield config.getRootManifests();
    const manifests = [];

    for (var _iterator = args, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref2 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref2 = _i.value;
      }

      const name = _ref2;

      reporter.step(++step, totalSteps, `Removing module ${name}`, emoji.get('wastebasket'));

      let found = false;

      for (var _iterator2 = Object.keys((_index || _load_index()).registries), _isArray2 = Array.isArray(_iterator2), _i3 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i3 >= _iterator2.length) break;
          _ref3 = _iterator2[_i3++];
        } else {
          _i3 = _iterator2.next();
          if (_i3.done) break;
          _ref3 = _i3.value;
        }

        const registryName = _ref3;

        const registry = config.registries[registryName];
        const object = rootManifests[registryName].object;

        for (var _iterator3 = (_constants || _load_constants()).DEPENDENCY_TYPES, _isArray3 = Array.isArray(_iterator3), _i4 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
          var _ref4;

          if (_isArray3) {
            if (_i4 >= _iterator3.length) break;
            _ref4 = _iterator3[_i4++];
          } else {
            _i4 = _iterator3.next();
            if (_i4.done) break;
            _ref4 = _i4.value;
          }

          const type = _ref4;

          const deps = object[type];
          if (deps && deps[name]) {
            found = true;
            delete deps[name];
          }
        }

        const possibleManifestLoc = path.join(config.cwd, registry.folder, name);
        if (yield (_fs || _load_fs()).exists(possibleManifestLoc)) {
          const manifest = yield config.maybeReadManifest(possibleManifestLoc, registryName);
          if (manifest) {
            manifests.push([possibleManifestLoc, manifest]);
          }
        }
      }

      if (!found) {
        throw new (_errors || _load_errors()).MessageError(reporter.lang('moduleNotInManifest'));
      }
    }

    // save manifests
    yield config.saveRootManifests(rootManifests);

    // run hooks - npm runs these one after another
    var _arr = ['preuninstall', 'uninstall', 'postuninstall'];
    for (var _i2 = 0; _i2 < _arr.length; _i2++) {
      const action = _arr[_i2];
      for (var _iterator4 = manifests, _isArray4 = Array.isArray(_iterator4), _i5 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray4) {
          if (_i5 >= _iterator4.length) break;
          _ref6 = _iterator4[_i5++];
        } else {
          _i5 = _iterator4.next();
          if (_i5.done) break;
          _ref6 = _i5.value;
        }

        const _ref5 = _ref6;
        const loc = _ref5[0];

        yield config.executeLifecycleScript(action, loc);
      }
    }

    // reinstall so we can get the updated lockfile
    reporter.step(++step, totalSteps, reporter.lang('uninstallRegenerate'), emoji.get('hammer'));
    const installFlags = (0, (_extends2 || _load_extends()).default)({ force: true, workspaceRootIsCwd: true }, flags);
    const reinstall = new (_install || _load_install()).Install(installFlags, config, new (_index2 || _load_index2()).NoopReporter(), lockfile);
    yield reinstall.init();

    //
    reporter.success(reporter.lang('uninstalledPackages'));
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _index;

function _load_index() {
  return _index = require('../../registries/index.js');
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _index2;

function _load_index2() {
  return _index2 = require('../../reporters/index.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../../constants.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

const emoji = require('node-emoji');

const requireLockfile = exports.requireLockfile = true;

function setFlags(commander) {
  commander.description('Removes a package from your direct dependencies updating your package.json and yarn.lock.');
  commander.usage('remove [packages ...] [flags]');
  commander.option('-W, --ignore-workspace-root-check', 'required to run yarn remove inside a workspace root');
}

function hasWrapper(commander, args) {
  return true;
}