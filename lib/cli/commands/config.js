'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.examples = exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _buildSubCommands2;

function _load_buildSubCommands() {
  return _buildSubCommands2 = _interopRequireDefault(require('./_build-sub-commands.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const CONFIG_KEYS = [
// 'reporter',
'registryFolders', 'linkedModules',
// 'registries',
'cache', 'cwd', 'looseSemver', 'commandName', 'preferOffline', 'modulesFolder', 'globalFolder', 'linkFolder', 'offline', 'binLinks', 'ignorePlatform', 'ignoreScripts', 'disablePrepublish', 'nonInteractive', 'workspaceRootFolder', 'lockfileFolder', 'networkConcurrency', 'childConcurrency', 'networkTimeout', 'workspacesEnabled', 'workspacesNohoistEnabled', 'pruneOfflineMirror', 'enableMetaFolder', 'enableLockfileVersions', 'linkFileDependencies', 'cacheFolder', 'tempFolder', 'production'];
/* eslint object-shorthand: 0 */

function hasWrapper(flags, args) {
  return args[0] !== 'get';
}

function setFlags(commander) {
  commander.description('Manages the yarn configuration files.');
}

var _buildSubCommands = (0, (_buildSubCommands2 || _load_buildSubCommands()).default)('config', {
  set(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (args.length === 0 || args.length > 2) {
        return false;
      }
      const key = args[0];
      var _args$ = args[1];
      const val = _args$ === undefined ? true : _args$;

      const yarnConfig = config.registries.yarn;
      yield yarnConfig.saveHomeConfig({ [key]: val });
      reporter.success(reporter.lang('configSet', key, val));
      return true;
    })();
  },

  get(config, reporter, flags, args) {
    if (args.length !== 1) {
      return false;
    }

    reporter.log(String(config.getOption(args[0])), { force: true });
    return true;
  },

  delete: (() => {
    var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
      if (args.length !== 1) {
        return false;
      }

      const key = args[0];
      const yarnConfig = config.registries.yarn;
      yield yarnConfig.saveHomeConfig({ [key]: undefined });
      reporter.success(reporter.lang('configDelete', key));
      return true;
    });

    function _delete(_x, _x2, _x3, _x4) {
      return _ref.apply(this, arguments);
    }

    return _delete;
  })(),

  list(config, reporter, flags, args) {
    if (args.length) {
      return false;
    }

    reporter.info(reporter.lang('configYarn'));
    reporter.inspect(config.registries.yarn.config);

    reporter.info(reporter.lang('configNpm'));
    reporter.inspect(config.registries.npm.config);

    return true;
  },

  current(config, reporter, flags, args) {
    if (args.length) {
      return false;
    }

    reporter.log(JSON.stringify(config, CONFIG_KEYS, 2), { force: true });

    return true;
  }
});

const run = _buildSubCommands.run,
      examples = _buildSubCommands.examples;
exports.run = run;
exports.examples = examples;