'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.setVersion = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let setVersion = exports.setVersion = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args, required) {
    const pkg = yield config.readRootManifest();
    const pkgLoc = pkg._loc;
    const scripts = (0, (_map || _load_map()).default)();
    let newVersion = flags.newVersion;
    invariant(pkgLoc, 'expected package location');

    if (args.length && !newVersion) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('invalidVersionArgument', NEW_VERSION_FLAG));
    }

    function runLifecycle(lifecycle) {
      if (scripts[lifecycle]) {
        return (0, (_executeLifecycleScript || _load_executeLifecycleScript()).execCommand)({ stage: lifecycle, config, cmd: scripts[lifecycle], cwd: config.cwd, isInteractive: true });
      }

      return Promise.resolve();
    }

    function isCommitHooksDisabled() {
      return flags.commitHooks === false || config.getOption('version-commit-hooks') === false;
    }

    if (pkg.scripts) {
      // inherit `scripts` from manifest
      Object.assign(scripts, pkg.scripts);
    }

    // get old version
    let oldVersion = pkg.version;
    if (oldVersion) {
      reporter.info(`${reporter.lang('currentVersion')}: ${oldVersion}`);
    } else {
      oldVersion = '0.0.0';
    }

    // get new version
    if (newVersion && !isValidNewVersion(oldVersion, newVersion, config.looseSemver)) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('invalidVersion'));
    }

    // get new version by bumping old version, if requested
    if (!newVersion) {
      if (flags.major) {
        newVersion = semver.inc(oldVersion, 'major');
      } else if (flags.minor) {
        newVersion = semver.inc(oldVersion, 'minor');
      } else if (flags.patch) {
        newVersion = semver.inc(oldVersion, 'patch');
      }
    }

    // wasn't passed a version arg so ask interactively
    while (!newVersion) {
      // make sure we're not running in non-interactive mode before asking for new version
      if (flags.nonInteractive || config.nonInteractive) {
        // if no version is specified, use current version in package.json
        newVersion = oldVersion;
        break;
      }

      // Make sure we dont exit with an error message when pressing Ctrl-C or enter to abort
      try {
        newVersion = yield reporter.question(reporter.lang('newVersion'));
        if (!newVersion) {
          newVersion = oldVersion;
        }
      } catch (err) {
        newVersion = oldVersion;
      }

      if (!required && !newVersion) {
        reporter.info(`${reporter.lang('noVersionOnPublish')}: ${oldVersion}`);
        return function () {
          return Promise.resolve();
        };
      }

      if (isValidNewVersion(oldVersion, newVersion, config.looseSemver)) {
        break;
      } else {
        newVersion = null;
        reporter.error(reporter.lang('invalidSemver'));
      }
    }
    if (newVersion) {
      newVersion = semver.inc(oldVersion, newVersion, config.looseSemver) || newVersion;
    }
    invariant(newVersion, 'expected new version');

    if (newVersion === pkg.version) {
      return function () {
        return Promise.resolve();
      };
    }

    yield runLifecycle('preversion');

    // update version
    reporter.info(`${reporter.lang('newVersion')}: ${newVersion}`);
    pkg.version = newVersion;

    // update versions in manifests
    const manifests = yield config.getRootManifests();
    for (var _iterator = (_index || _load_index()).registryNames, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref2 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref2 = _i.value;
      }

      const registryName = _ref2;

      const manifest = manifests[registryName];
      if (manifest.exists) {
        manifest.object.version = newVersion;
      }
    }
    yield config.saveRootManifests(manifests);

    yield runLifecycle('version');

    // check if committing the new version to git is overriden
    if (!flags.gitTagVersion || !config.getOption('version-git-tag')) {
      // Don't tag the version in Git
      return function () {
        return Promise.resolve();
      };
    }

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      invariant(newVersion, 'expected version');

      // add git commit and tag
      let isGit = false;
      const parts = config.cwd.split(path.sep);
      while (parts.length) {
        isGit = yield (_fs || _load_fs()).exists(path.join(parts.join(path.sep), '.git'));
        if (isGit) {
          break;
        } else {
          parts.pop();
        }
      }

      if (isGit) {
        const message = (flags.message || String(config.getOption('version-git-message'))).replace(/%s/g, newVersion);
        const sign = Boolean(config.getOption('version-sign-git-tag'));
        const flag = sign ? '-sm' : '-am';
        const prefix = String(config.getOption('version-tag-prefix'));
        const args = ['commit', '-m', message, ...(isCommitHooksDisabled() ? ['-n'] : [])];

        const gitRoot = (yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['rev-parse', '--show-toplevel'], { cwd: config.cwd })).trim();

        // add manifest
        yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['add', path.relative(gitRoot, pkgLoc)], { cwd: gitRoot });

        // create git commit
        yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(args, { cwd: gitRoot });

        // create git tag
        yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['tag', `${prefix}${newVersion}`, flag, message], { cwd: gitRoot });
      }

      yield runLifecycle('postversion');
    });
  });

  return function setVersion(_x, _x2, _x3, _x4, _x5) {
    return _ref.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref4 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const commit = yield setVersion(config, reporter, flags, args, true);
    yield commit();
  });

  return function run(_x6, _x7, _x8, _x9) {
    return _ref4.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _index;

function _load_index() {
  return _index = require('../../registries/index.js');
}

var _executeLifecycleScript;

function _load_executeLifecycleScript() {
  return _executeLifecycleScript = require('../../util/execute-lifecycle-script.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _gitSpawn;

function _load_gitSpawn() {
  return _gitSpawn = require('../../util/git/git-spawn.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('../../util/map.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');
const semver = require('semver');
const path = require('path');

const NEW_VERSION_FLAG = '--new-version [version]';
function isValidNewVersion(oldVersion, newVersion, looseSemver) {
  return !!(semver.valid(newVersion, looseSemver) || semver.inc(oldVersion, newVersion, looseSemver));
}

function setFlags(commander) {
  commander.description('Update the version of your package via the command line.');
  commander.option(NEW_VERSION_FLAG, 'new version');
  commander.option('--major', 'auto-increment major version number');
  commander.option('--minor', 'auto-increment minor version number');
  commander.option('--patch', 'auto-increment patch version number');
  commander.option('--message [message]', 'message');
  commander.option('--no-git-tag-version', 'no git tag version');
  commander.option('--no-commit-hooks', 'bypass git hooks when committing new version');
}

function hasWrapper(commander, args) {
  return true;
}