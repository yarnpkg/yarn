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
    const outdatedFieldName = flags.latest ? 'latest' : 'wanted';
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder);

    const deps = yield (0, (_upgrade || _load_upgrade()).getOutdated)(config, reporter, (0, (_extends2 || _load_extends()).default)({}, flags, { includeWorkspaceDeps: true }), lockfile, args);

    if (deps.length === 0) {
      reporter.success(reporter.lang('allDependenciesUpToDate'));
      return;
    }

    // Fail early with runtime compatibility checks so that it doesn't fail after you've made your selections
    const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);
    yield install.checkCompatibility();

    const usesWorkspaces = !!config.workspaceRootFolder;

    const maxLengthArr = {
      name: 'name'.length,
      current: 'from'.length,
      range: 'latest'.length,
      [outdatedFieldName]: 'to'.length,
      workspaceName: 'workspace'.length
    };

    const keysWithDynamicLength = ['name', 'current', outdatedFieldName];

    if (!flags.latest) {
      maxLengthArr.range = 'range'.length;
      keysWithDynamicLength.push('range');
    }

    if (usesWorkspaces) {
      keysWithDynamicLength.push('workspaceName');
    }

    deps.forEach(function (dep) {
      return keysWithDynamicLength.forEach(function (key) {
        maxLengthArr[key] = Math.max(maxLengthArr[key], dep[key].length);
      });
    });

    // Depends on maxLengthArr
    const addPadding = function addPadding(dep) {
      return function (key) {
        return `${dep[key]}${' '.repeat(maxLengthArr[key] - dep[key].length)}`;
      };
    };
    const headerPadding = function headerPadding(header, key) {
      return `${reporter.format.bold.underline(header)}${' '.repeat(maxLengthArr[key] - header.length)}`;
    };

    const colorizeName = function colorizeName(from, to) {
      return reporter.format[(0, (_colorForVersions || _load_colorForVersions()).default)(from, to)];
    };

    const getNameFromHint = function getNameFromHint(hint) {
      return hint ? `${hint}Dependencies` : 'dependencies';
    };

    const makeRow = function makeRow(dep) {
      const padding = addPadding(dep);
      const name = colorizeName(dep.current, dep[outdatedFieldName])(padding('name'));
      const current = reporter.format.blue(padding('current'));
      const latest = (0, (_colorizeDiff || _load_colorizeDiff()).default)(dep.current, padding(outdatedFieldName), reporter);
      const url = reporter.format.cyan(dep.url);
      const range = reporter.format.blue(flags.latest ? 'latest' : padding('range'));
      if (usesWorkspaces) {
        const workspace = padding('workspaceName');
        return `${name}  ${range}  ${current}  ❯  ${latest}  ${workspace}  ${url}`;
      } else {
        return `${name}  ${range}  ${current}  ❯  ${latest}  ${url}`;
      }
    };

    const makeHeaderRow = function makeHeaderRow() {
      const name = headerPadding('name', 'name');
      const range = headerPadding('range', 'range');
      const from = headerPadding('from', 'current');
      const to = headerPadding('to', outdatedFieldName);
      const url = reporter.format.bold.underline('url');
      if (usesWorkspaces) {
        const workspace = headerPadding('workspace', 'workspaceName');
        return `  ${name}  ${range}  ${from}     ${to}  ${workspace}  ${url}`;
      } else {
        return `  ${name}  ${range}  ${from}     ${to}  ${url}`;
      }
    };

    const groupedDeps = deps.reduce(function (acc, dep) {
      const hint = dep.hint,
            name = dep.name,
            upgradeTo = dep.upgradeTo;

      const version = dep[outdatedFieldName];
      const key = getNameFromHint(hint);
      const xs = acc[key] || [];
      acc[key] = xs.concat({
        name: makeRow(dep),
        value: dep,
        short: `${name}@${version}`,
        upgradeTo
      });
      return acc;
    }, {});

    const flatten = function flatten(xs) {
      return xs.reduce(function (ys, y) {
        return ys.concat(Array.isArray(y) ? flatten(y) : y);
      }, []);
    };

    const choices = flatten(Object.keys(groupedDeps).map(function (key) {
      return [new (_inquirer || _load_inquirer()).default.Separator(reporter.format.bold.underline.green(key)), new (_inquirer || _load_inquirer()).default.Separator(makeHeaderRow()), groupedDeps[key], new (_inquirer || _load_inquirer()).default.Separator(' ')];
    }));

    try {
      const red = reporter.format.red('<red>');
      const yellow = reporter.format.yellow('<yellow>');
      const green = reporter.format.green('<green>');
      reporter.info(reporter.lang('legendColorsForVersionUpdates', red, yellow, green));

      const answers = yield reporter.prompt('Choose which packages to update.', choices, {
        name: 'packages',
        type: 'checkbox',
        validate: function validate(answer) {
          return !!answer.length || 'You must choose at least one package.';
        }
      });

      const getPattern = function getPattern({ upgradeTo }) {
        return upgradeTo;
      };
      const isHint = function isHint(x) {
        return function ({ hint }) {
          return hint === x;
        };
      };

      var _arr = [null, 'dev', 'optional', 'peer'];
      for (var _i = 0; _i < _arr.length; _i++) {
        const hint = _arr[_i];
        // Reset dependency flags
        flags.dev = hint === 'dev';
        flags.peer = hint === 'peer';
        flags.optional = hint === 'optional';
        flags.ignoreWorkspaceRootCheck = true;
        flags.includeWorkspaceDeps = false;
        flags.workspaceRootIsCwd = false;
        const deps = answers.filter(isHint(hint));
        if (deps.length) {
          const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);

          var _ref2 = yield install.fetchRequestFromCwd();

          const packagePatterns = _ref2.requests;

          const depsByWorkspace = deps.reduce(function (acc, dep) {
            const workspaceLoc = dep.workspaceLoc;

            const xs = acc[workspaceLoc] || [];
            acc[workspaceLoc] = xs.concat(dep);
            return acc;
          }, {});
          const cwd = config.cwd;
          for (var _iterator = Object.keys(depsByWorkspace), _isArray = Array.isArray(_iterator), _i2 = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
            var _ref3;

            if (_isArray) {
              if (_i2 >= _iterator.length) break;
              _ref3 = _iterator[_i2++];
            } else {
              _i2 = _iterator.next();
              if (_i2.done) break;
              _ref3 = _i2.value;
            }

            const loc = _ref3;

            const patterns = depsByWorkspace[loc].map(getPattern);
            (0, (_upgrade || _load_upgrade()).cleanLockfile)(lockfile, deps, packagePatterns, reporter);
            reporter.info(reporter.lang('updateInstalling', getNameFromHint(hint)));
            if (loc !== '') {
              config.cwd = path.resolve(path.dirname(loc));
            }
            const add = new (_add || _load_add()).Add(patterns, flags, config, reporter, lockfile);
            yield add.init();
            config.cwd = cwd;
          }
        }
      }
    } catch (e) {
      Promise.reject(e);
    }
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _inquirer;

function _load_inquirer() {
  return _inquirer = _interopRequireDefault(require('inquirer'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _add;

function _load_add() {
  return _add = require('./add.js');
}

var _upgrade;

function _load_upgrade() {
  return _upgrade = require('./upgrade.js');
}

var _colorForVersions;

function _load_colorForVersions() {
  return _colorForVersions = _interopRequireDefault(require('../../util/color-for-versions'));
}

var _colorizeDiff;

function _load_colorizeDiff() {
  return _colorizeDiff = _interopRequireDefault(require('../../util/colorize-diff.js'));
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

const requireLockfile = exports.requireLockfile = true;

function setFlags(commander) {
  commander.description('Provides an easy way to update outdated packages.');
  commander.usage('upgrade-interactive [flags]');
  commander.option('-S, --scope <scope>', 'upgrade packages under the specified scope');
  commander.option('--latest', 'list the latest version of packages, ignoring version ranges in package.json');
  commander.option('-E, --exact', 'install exact version. Only used when --latest is specified.');
  commander.option('-T, --tilde', 'install most recent release with the same minor version. Only used when --latest is specified.');
  commander.option('-C, --caret', 'install most recent release with the same major version. Only used when --latest is specified.');
}

function hasWrapper(commander, args) {
  return true;
}