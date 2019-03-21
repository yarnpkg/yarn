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
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder);
    const install = new (_install || _load_install()).Install((0, (_extends2 || _load_extends()).default)({}, flags, { includeWorkspaceDeps: true }), config, reporter, lockfile);
    let deps = yield (_packageRequest || _load_packageRequest()).default.getOutdatedPackages(lockfile, install, config, reporter);

    if (args.length) {
      const requested = new Set(args);

      deps = deps.filter(function ({ name }) {
        return requested.has(name);
      });
    }

    const getNameFromHint = function getNameFromHint(hint) {
      return hint ? `${hint}Dependencies` : 'dependencies';
    };
    const colorizeName = function colorizeName({ current, latest, name }) {
      return reporter.format[(0, (_colorForVersions || _load_colorForVersions()).default)(current, latest)](name);
    };

    if (deps.length) {
      const usesWorkspaces = !!config.workspaceRootFolder;
      const body = deps.map(function (info) {
        const row = [colorizeName(info), info.current, (0, (_colorizeDiff || _load_colorizeDiff()).default)(info.current, info.wanted, reporter), reporter.format.cyan(info.latest), info.workspaceName || '', getNameFromHint(info.hint), reporter.format.cyan(info.url)];
        if (!usesWorkspaces) {
          row.splice(4, 1);
        }
        return row;
      });

      const red = reporter.format.red('<red>');
      const yellow = reporter.format.yellow('<yellow>');
      const green = reporter.format.green('<green>');
      reporter.info(reporter.lang('legendColorsForVersionUpdates', red, yellow, green));

      const header = ['Package', 'Current', 'Wanted', 'Latest', 'Workspace', 'Package Type', 'URL'];
      if (!usesWorkspaces) {
        header.splice(4, 1);
      }
      reporter.table(header, body);

      return 1;
    }
    return 0;
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _packageRequest;

function _load_packageRequest() {
  return _packageRequest = _interopRequireDefault(require('../../package-request.js'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _colorForVersions;

function _load_colorForVersions() {
  return _colorForVersions = _interopRequireDefault(require('../../util/color-for-versions'));
}

var _colorizeDiff;

function _load_colorizeDiff() {
  return _colorizeDiff = _interopRequireDefault(require('../../util/colorize-diff.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const requireLockfile = exports.requireLockfile = true;

function setFlags(commander) {
  commander.description('Checks for outdated package dependencies.');
  commander.usage('outdated [packages ...]');
}

function hasWrapper(commander, args) {
  return true;
}