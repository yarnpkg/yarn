'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.getBinEntries = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getBinEntries = exports.getBinEntries = (() => {
  var _ref3 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    const binFolders = new Set();
    const binEntries = new Map();

    // Setup the node_modules/.bin folders for analysis
    for (var _iterator2 = config.registryFolders, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref4 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref4 = _i2.value;
      }

      const registryFolder = _ref4;

      binFolders.add(path.resolve(config.lockfileFolder, registryFolder, '.bin'));
    }

    // Same thing, but for the pnp dependencies, located inside the cache
    if (yield (_fs || _load_fs()).exists(`${config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`)) {
      const pnpApi = (0, (_dynamicRequire || _load_dynamicRequire()).dynamicRequire)(`${config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`);

      const packageLocator = pnpApi.findPackageLocator(`${config.cwd}/`);
      const packageInformation = pnpApi.getPackageInformation(packageLocator);

      for (var _iterator3 = packageInformation.packageDependencies.entries(), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref6 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref6 = _i3.value;
        }

        const _ref5 = _ref6;
        const name = _ref5[0];
        const reference = _ref5[1];

        const dependencyInformation = pnpApi.getPackageInformation({ name, reference });

        if (dependencyInformation.packageLocation) {
          binFolders.add(`${dependencyInformation.packageLocation}/.bin`);
        }
      }
    }

    // Build up a list of possible scripts by exploring the folders marked for analysis
    for (var _iterator4 = binFolders, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref7 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref7 = _i4.value;
      }

      const binFolder = _ref7;

      if (yield (_fs || _load_fs()).exists(binFolder)) {
        for (var _iterator5 = yield (_fs || _load_fs()).readdir(binFolder), _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
          var _ref8;

          if (_isArray5) {
            if (_i5 >= _iterator5.length) break;
            _ref8 = _iterator5[_i5++];
          } else {
            _i5 = _iterator5.next();
            if (_i5.done) break;
            _ref8 = _i5.value;
          }

          const name = _ref8;

          binEntries.set(name, path.join(binFolder, name));
        }
      }
    }

    return binEntries;
  });

  return function getBinEntries(_x) {
    return _ref3.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref9 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    let runCommand = (() => {
      var _ref13 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (args) {
        const action = args.shift();

        // build up list of commands
        const cmds = [];

        if (pkgScripts && action in pkgScripts) {
          const preAction = `pre${action}`;
          if (preAction in pkgScripts) {
            cmds.push([preAction, pkgScripts[preAction]]);
          }

          const script = scripts.get(action);
          invariant(script, 'Script must exist');
          cmds.push([action, script]);

          const postAction = `post${action}`;
          if (postAction in pkgScripts) {
            cmds.push([postAction, pkgScripts[postAction]]);
          }
        } else if (scripts.has(action)) {
          const script = scripts.get(action);
          invariant(script, 'Script must exist');
          cmds.push([action, script]);
        }

        if (cmds.length) {
          const ignoreEngines = !!(flags.ignoreEngines || config.getOption('ignore-engines'));
          try {
            yield (0, (_packageCompatibility || _load_packageCompatibility()).checkOne)(pkg, config, ignoreEngines);
          } catch (err) {
            throw err instanceof (_errors || _load_errors()).MessageError ? new (_errors || _load_errors()).MessageError(reporter.lang('cannotRunWithIncompatibleEnv')) : err;
          }

          // Disable wrapper in executed commands
          process.env.YARN_WRAP_OUTPUT = 'false';
          for (var _iterator8 = cmds, _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
            var _ref15;

            if (_isArray8) {
              if (_i8 >= _iterator8.length) break;
              _ref15 = _iterator8[_i8++];
            } else {
              _i8 = _iterator8.next();
              if (_i8.done) break;
              _ref15 = _i8.value;
            }

            const _ref14 = _ref15;
            const stage = _ref14[0];
            const cmd = _ref14[1];

            // only tack on trailing arguments for default script, ignore for pre and post - #1595
            const cmdWithArgs = stage === action ? sh`${unquoted(cmd)} ${args}` : cmd;
            const customShell = config.getOption('script-shell');
            yield (0, (_executeLifecycleScript || _load_executeLifecycleScript()).execCommand)({
              stage,
              config,
              cmd: cmdWithArgs,
              cwd: flags.into || config.cwd,
              isInteractive: true,
              customShell: customShell ? String(customShell) : undefined
            });
          }
        } else if (action === 'env') {
          reporter.log(JSON.stringify((yield (0, (_executeLifecycleScript || _load_executeLifecycleScript()).makeEnv)('env', config.cwd, config)), null, 2), { force: true });
        } else {
          let suggestion;

          for (const commandName in scripts) {
            const steps = leven(commandName, action);
            if (steps < 2) {
              suggestion = commandName;
            }
          }

          let msg = `Command ${JSON.stringify(action)} not found.`;
          if (suggestion) {
            msg += ` Did you mean ${JSON.stringify(suggestion)}?`;
          }
          throw new (_errors || _load_errors()).MessageError(msg);
        }
      });

      return function runCommand(_x6) {
        return _ref13.apply(this, arguments);
      };
    })();

    // list possible scripts if none specified


    const pkg = yield config.readManifest(config.cwd);

    const binCommands = new Set();
    const pkgCommands = new Set();

    const scripts = new Map();

    for (var _iterator6 = yield getBinEntries(config), _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
      var _ref11;

      if (_isArray6) {
        if (_i6 >= _iterator6.length) break;
        _ref11 = _iterator6[_i6++];
      } else {
        _i6 = _iterator6.next();
        if (_i6.done) break;
        _ref11 = _i6.value;
      }

      const _ref10 = _ref11;
      const name = _ref10[0];
      const loc = _ref10[1];

      scripts.set(name, quoteForShell(loc));
      binCommands.add(name);
    }

    const pkgScripts = pkg.scripts;

    if (pkgScripts) {
      for (var _iterator7 = Object.keys(pkgScripts).sort(), _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
        var _ref12;

        if (_isArray7) {
          if (_i7 >= _iterator7.length) break;
          _ref12 = _iterator7[_i7++];
        } else {
          _i7 = _iterator7.next();
          if (_i7.done) break;
          _ref12 = _i7.value;
        }

        const name = _ref12;

        scripts.set(name, pkgScripts[name] || '');
        pkgCommands.add(name);
      }
    }

    if (args.length === 0) {
      if (binCommands.size > 0) {
        reporter.info(`${reporter.lang('binCommands') + Array.from(binCommands).join(', ')}`);
      } else {
        reporter.error(reporter.lang('noBinAvailable'));
      }

      const printedCommands = new Map();

      for (var _iterator9 = pkgCommands, _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
        var _ref16;

        if (_isArray9) {
          if (_i9 >= _iterator9.length) break;
          _ref16 = _iterator9[_i9++];
        } else {
          _i9 = _iterator9.next();
          if (_i9.done) break;
          _ref16 = _i9.value;
        }

        const pkgCommand = _ref16;

        const action = scripts.get(pkgCommand);
        invariant(action, 'Action must exists');
        printedCommands.set(pkgCommand, action);
      }

      if (pkgCommands.size > 0) {
        reporter.info(`${reporter.lang('possibleCommands')}`);
        reporter.list('possibleCommands', Array.from(pkgCommands), toObject(printedCommands));
        if (!flags.nonInteractive) {
          yield reporter.question(reporter.lang('commandQuestion')).then(function (answer) {
            return runCommand(answer.trim().split(' '));
          }, function () {
            return reporter.error(reporter.lang('commandNotSpecified'));
          });
        }
      } else {
        reporter.error(reporter.lang('noScriptsAvailable'));
      }
      return Promise.resolve();
    } else {
      return runCommand(args);
    }
  });

  return function run(_x2, _x3, _x4, _x5) {
    return _ref9.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _executeLifecycleScript;

function _load_executeLifecycleScript() {
  return _executeLifecycleScript = require('../../util/execute-lifecycle-script.js');
}

var _dynamicRequire;

function _load_dynamicRequire() {
  return _dynamicRequire = require('../../util/dynamic-require.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _packageCompatibility;

function _load_packageCompatibility() {
  return _packageCompatibility = require('../../package-compatibility.js');
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

const invariant = require('invariant');
const leven = require('leven');
const path = require('path');

var _require = require('puka');

const quoteForShell = _require.quoteForShell,
      sh = _require.sh,
      unquoted = _require.unquoted;


function toObject(input) {
  const output = Object.create(null);

  for (var _iterator = input.entries(), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref2;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref2 = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref2 = _i.value;
    }

    const _ref = _ref2;
    const key = _ref[0];
    const val = _ref[1];

    output[key] = val;
  }

  return output;
}

function setFlags(commander) {
  commander.description('Runs a defined package script.');
}

function hasWrapper(commander, args) {
  return true;
}