'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.execCommand = exports.execFromManifest = exports.executeLifecycleScript = exports.makeEnv = exports.getWrappersFolder = exports.IGNORE_MANIFEST_KEYS = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getWrappersFolder = exports.getWrappersFolder = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    if (wrappersFolder) {
      return wrappersFolder;
    }

    wrappersFolder = yield (_fs || _load_fs()).makeTempDir();

    yield (0, (_portableScript || _load_portableScript()).makePortableProxyScript)(process.execPath, wrappersFolder, {
      proxyBasename: 'node'
    });

    yield (0, (_portableScript || _load_portableScript()).makePortableProxyScript)(process.execPath, wrappersFolder, {
      proxyBasename: 'yarn',
      prependArguments: [process.argv[1]]
    });

    return wrappersFolder;
  });

  return function getWrappersFolder(_x) {
    return _ref.apply(this, arguments);
  };
})();

let makeEnv = exports.makeEnv = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (stage, cwd, config) {
    const env = (0, (_extends2 || _load_extends()).default)({
      NODE: process.execPath,
      INIT_CWD: process.cwd()
    }, process.env);

    // Merge in the `env` object specified in .yarnrc
    const customEnv = config.getOption('env');
    if (customEnv && typeof customEnv === 'object') {
      Object.assign(env, customEnv);
    }

    env.npm_lifecycle_event = stage;
    env.npm_node_execpath = env.NODE;
    env.npm_execpath = env.npm_execpath || process.mainModule && process.mainModule.filename;

    // Set the env to production for npm compat if production mode.
    // https://github.com/npm/npm/blob/30d75e738b9cb7a6a3f9b50e971adcbe63458ed3/lib/utils/lifecycle.js#L336
    if (config.production) {
      env.NODE_ENV = 'production';
    }

    // Note: npm_config_argv environment variable contains output of nopt - command-line
    // parser used by npm. Since we use other parser, we just roughly emulate it's output. (See: #684)
    env.npm_config_argv = JSON.stringify({
      remain: [],
      cooked: config.commandName === 'run' ? [config.commandName, stage] : [config.commandName],
      original: process.argv.slice(2)
    });

    const manifest = yield config.maybeReadManifest(cwd);
    if (manifest) {
      if (manifest.scripts && Object.prototype.hasOwnProperty.call(manifest.scripts, stage)) {
        env.npm_lifecycle_script = manifest.scripts[stage];
      }

      // add npm_package_*
      const queue = [['', manifest]];
      while (queue.length) {
        var _queue$pop = queue.pop();

        const key = _queue$pop[0],
              val = _queue$pop[1];

        if (typeof val === 'object') {
          for (const subKey in val) {
            const fullKey = [key, subKey].filter(Boolean).join('_');
            if (fullKey && fullKey[0] !== '_' && !IGNORE_MANIFEST_KEYS.has(fullKey)) {
              queue.push([fullKey, val[subKey]]);
            }
          }
        } else {
          let cleanVal = String(val);
          if (cleanVal.indexOf('\n') >= 0) {
            cleanVal = JSON.stringify(cleanVal);
          }

          //replacing invalid chars with underscore
          const cleanKey = key.replace(INVALID_CHAR_REGEX, '_');

          env[`npm_package_${cleanKey}`] = cleanVal;
        }
      }
    }

    // add npm_config_* and npm_package_config_* from yarn config
    const keys = new Set([...Object.keys(config.registries.yarn.config), ...Object.keys(config.registries.npm.config)]);
    const cleaned = Array.from(keys).filter(function (key) {
      return !key.match(/:_/) && IGNORE_CONFIG_KEYS.indexOf(key) === -1;
    }).map(function (key) {
      let val = config.getOption(key);
      if (!val) {
        val = '';
      } else if (typeof val === 'number') {
        val = '' + val;
      } else if (typeof val !== 'string') {
        val = JSON.stringify(val);
      }

      if (val.indexOf('\n') >= 0) {
        val = JSON.stringify(val);
      }
      return [key, val];
    });
    // add npm_config_*
    for (var _iterator = cleaned, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref4 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref4 = _i.value;
      }

      const _ref3 = _ref4;
      const key = _ref3[0];
      const val = _ref3[1];

      const cleanKey = key.replace(/^_+/, '');
      const envKey = `npm_config_${cleanKey}`.replace(INVALID_CHAR_REGEX, '_');
      env[envKey] = val;
    }
    // add npm_package_config_*
    if (manifest && manifest.name) {
      const packageConfigPrefix = `${manifest.name}:`;
      for (var _iterator2 = cleaned, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref6 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref6 = _i2.value;
        }

        const _ref5 = _ref6;
        const key = _ref5[0];
        const val = _ref5[1];

        if (key.indexOf(packageConfigPrefix) !== 0) {
          continue;
        }
        const cleanKey = key.replace(/^_+/, '').replace(packageConfigPrefix, '');
        const envKey = `npm_package_config_${cleanKey}`.replace(INVALID_CHAR_REGEX, '_');
        env[envKey] = val;
      }
    }

    // split up the path
    const envPath = env[(_constants || _load_constants()).ENV_PATH_KEY];
    const pathParts = envPath ? envPath.split(path.delimiter) : [];

    // Include node-gyp version that was bundled with the current Node.js version,
    // if available.
    pathParts.unshift(path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'node-gyp-bin'));
    pathParts.unshift(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'node-gyp-bin'));
    // Include node-gyp version from homebrew managed npm, if available.
    pathParts.unshift(path.join(path.dirname(process.execPath), '..', 'libexec', 'lib', 'node_modules', 'npm', 'bin', 'node-gyp-bin'));

    // Add global bin folder if it is not present already, as some packages depend
    // on a globally-installed version of node-gyp.
    const globalBin = yield (0, (_global || _load_global()).getBinFolder)(config, {});
    if (pathParts.indexOf(globalBin) === -1) {
      pathParts.unshift(globalBin);
    }

    // Add node_modules .bin folders to the PATH
    for (var _iterator3 = config.registryFolders, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref7 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref7 = _i3.value;
      }

      const registryFolder = _ref7;

      const binFolder = path.join(registryFolder, '.bin');
      if (config.workspacesEnabled && config.workspaceRootFolder) {
        pathParts.unshift(path.join(config.workspaceRootFolder, binFolder));
      }
      pathParts.unshift(path.join(config.linkFolder, binFolder));
      pathParts.unshift(path.join(cwd, binFolder));
    }

    let pnpFile;

    if (process.versions.pnp) {
      pnpFile = (_dynamicRequire || _load_dynamicRequire()).dynamicRequire.resolve('pnpapi');
    } else {
      const candidate = `${config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`;
      if (yield (_fs || _load_fs()).exists(candidate)) {
        pnpFile = candidate;
      }
    }

    if (pnpFile) {
      const pnpApi = (0, (_dynamicRequire || _load_dynamicRequire()).dynamicRequire)(pnpFile);

      const packageLocator = pnpApi.findPackageLocator(`${cwd}/`);
      const packageInformation = pnpApi.getPackageInformation(packageLocator);

      for (var _iterator4 = packageInformation.packageDependencies.entries(), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref9;

        if (_isArray4) {
          if (_i4 >= _iterator4.length) break;
          _ref9 = _iterator4[_i4++];
        } else {
          _i4 = _iterator4.next();
          if (_i4.done) break;
          _ref9 = _i4.value;
        }

        const _ref8 = _ref9;
        const name = _ref8[0];
        const reference = _ref8[1];

        const dependencyInformation = pnpApi.getPackageInformation({ name, reference });

        if (!dependencyInformation || !dependencyInformation.packageLocation) {
          continue;
        }

        const binFolder = `${dependencyInformation.packageLocation}/.bin`;
        if (yield (_fs || _load_fs()).exists(binFolder)) {
          pathParts.unshift(binFolder);
        }
      }

      // Note that NODE_OPTIONS doesn't support any style of quoting its arguments at the moment
      // For this reason, it won't work if the user has a space inside its $PATH
      env.NODE_OPTIONS = env.NODE_OPTIONS || '';
      env.NODE_OPTIONS = `--require ${pnpFile} ${env.NODE_OPTIONS}`;
    }

    pathParts.unshift((yield getWrappersFolder(config)));

    // join path back together
    env[(_constants || _load_constants()).ENV_PATH_KEY] = pathParts.join(path.delimiter);

    return env;
  });

  return function makeEnv(_x2, _x3, _x4) {
    return _ref2.apply(this, arguments);
  };
})();

let executeLifecycleScript = exports.executeLifecycleScript = (() => {
  var _ref10 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ({
    stage,
    config,
    cwd,
    cmd,
    isInteractive,
    onProgress,
    customShell
  }) {
    const env = yield makeEnv(stage, cwd, config);

    yield checkForGypIfNeeded(config, cmd, env[(_constants || _load_constants()).ENV_PATH_KEY].split(path.delimiter));

    if (process.platform === 'win32' && (!customShell || customShell === 'cmd')) {
      // handle windows run scripts starting with a relative path
      cmd = (0, (_fixCmdWinSlashes || _load_fixCmdWinSlashes()).fixCmdWinSlashes)(cmd);
    }

    // By default (non-interactive), pipe everything to the terminal and run child process detached
    // as long as it's not Windows (since windows does not have /dev/tty)
    let stdio = ['ignore', 'pipe', 'pipe'];
    let detached = process.platform !== 'win32';

    if (isInteractive) {
      stdio = 'inherit';
      detached = false;
    }

    const shell = customShell || true;
    const stdout = yield (_child || _load_child()).spawn(cmd, [], { cwd, env, stdio, detached, shell }, onProgress);

    return { cwd, command: cmd, stdout };
  });

  return function executeLifecycleScript(_x5) {
    return _ref10.apply(this, arguments);
  };
})();

let _checkForGyp = (() => {
  var _ref11 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, paths) {
    const reporter = config.reporter;

    // Check every directory in the PATH

    const allChecks = yield Promise.all(paths.map(function (dir) {
      return (_fs || _load_fs()).exists(path.join(dir, 'node-gyp'));
    }));
    if (allChecks.some(Boolean)) {
      // node-gyp is available somewhere
      return;
    }

    reporter.info(reporter.lang('packageRequiresNodeGyp'));

    try {
      yield (0, (_global || _load_global()).run)(config, reporter, {}, ['add', 'node-gyp']);
    } catch (e) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('nodeGypAutoInstallFailed', e.message));
    }
  });

  return function _checkForGyp(_x6, _x7) {
    return _ref11.apply(this, arguments);
  };
})();

let execFromManifest = exports.execFromManifest = (() => {
  var _ref12 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, commandName, cwd) {
    const pkg = yield config.maybeReadManifest(cwd);
    if (!pkg || !pkg.scripts) {
      return;
    }

    const cmd = pkg.scripts[commandName];
    if (cmd) {
      yield execCommand({ stage: commandName, config, cmd, cwd, isInteractive: true });
    }
  });

  return function execFromManifest(_x8, _x9, _x10) {
    return _ref12.apply(this, arguments);
  };
})();

let execCommand = exports.execCommand = (() => {
  var _ref13 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ({
    stage,
    config,
    cmd,
    cwd,
    isInteractive,
    customShell
  }) {
    const reporter = config.reporter;

    try {
      reporter.command(cmd);
      yield executeLifecycleScript({ stage, config, cwd, cmd, isInteractive, customShell });
      return Promise.resolve();
    } catch (err) {
      if (err instanceof (_errors || _load_errors()).ProcessTermError) {
        const formattedError = new (_errors || _load_errors()).ProcessTermError(err.EXIT_SIGNAL ? reporter.lang('commandFailedWithSignal', err.EXIT_SIGNAL) : reporter.lang('commandFailedWithCode', err.EXIT_CODE));
        formattedError.EXIT_CODE = err.EXIT_CODE;
        formattedError.EXIT_SIGNAL = err.EXIT_SIGNAL;
        throw formattedError;
      } else {
        throw err;
      }
    }
  });

  return function execCommand(_x11) {
    return _ref13.apply(this, arguments);
  };
})();

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../constants.js'));
}

var _child;

function _load_child() {
  return _child = _interopRequireWildcard(require('./child.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./fs.js'));
}

var _dynamicRequire;

function _load_dynamicRequire() {
  return _dynamicRequire = require('./dynamic-require.js');
}

var _portableScript;

function _load_portableScript() {
  return _portableScript = require('./portable-script.js');
}

var _fixCmdWinSlashes;

function _load_fixCmdWinSlashes() {
  return _fixCmdWinSlashes = require('./fix-cmd-win-slashes.js');
}

var _global;

function _load_global() {
  return _global = require('../cli/commands/global.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path');

const IGNORE_MANIFEST_KEYS = exports.IGNORE_MANIFEST_KEYS = new Set(['readme', 'notice', 'licenseText']);

// We treat these configs as internal, thus not expose them to process.env.
// This helps us avoid some gyp issues when building native modules.
// See https://github.com/yarnpkg/yarn/issues/2286.
const IGNORE_CONFIG_KEYS = ['lastUpdateCheck'];

let wrappersFolder = null;

const INVALID_CHAR_REGEX = /\W/g;

exports.default = executeLifecycleScript;


let checkGypPromise = null;
/**
 * Special case: Some packages depend on node-gyp, but don't specify this in
 * their package.json dependencies. They assume that node-gyp is available
 * globally. We need to detect this case and show an error message.
 */
function checkForGypIfNeeded(config, cmd, paths) {
  if (cmd.substr(0, cmd.indexOf(' ')) !== 'node-gyp') {
    return Promise.resolve();
  }

  // Ensure this only runs once, rather than multiple times in parallel.
  if (!checkGypPromise) {
    checkGypPromise = _checkForGyp(config, paths);
  }
  return checkGypPromise;
}