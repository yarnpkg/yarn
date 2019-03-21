'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DEFAULTS = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _constants;

function _load_constants() {
  return _constants = require('../constants.js');
}

var _npmRegistry;

function _load_npmRegistry() {
  return _npmRegistry = _interopRequireDefault(require('./npm-registry.js'));
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = require('../lockfile');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../util/fs.js'));
}

var _yarnVersion;

function _load_yarnVersion() {
  return _yarnVersion = require('../util/yarn-version.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const userHome = require('../util/user-home-dir').default;
const path = require('path');

const DEFAULTS = exports.DEFAULTS = {
  'version-tag-prefix': 'v',
  'version-git-tag': true,
  'version-commit-hooks': true,
  'version-git-sign': false,
  'version-git-message': 'v%s',

  'init-version': '1.0.0',
  'init-license': 'MIT',

  'save-prefix': '^',
  'bin-links': true,
  'ignore-scripts': false,
  'ignore-optional': false,
  registry: (_constants || _load_constants()).YARN_REGISTRY,
  'strict-ssl': true,
  'user-agent': [`yarn/${(_yarnVersion || _load_yarnVersion()).version}`, 'npm/?', `node/${process.version}`, process.platform, process.arch].join(' ')
};

const RELATIVE_KEYS = ['yarn-offline-mirror', 'cache-folder', 'global-folder', 'offline-cache-folder', 'yarn-path'];
const FOLDER_KEY = ['yarn-offline-mirror', 'cache-folder', 'global-folder', 'offline-cache-folder'];

const npmMap = {
  'version-git-sign': 'sign-git-tag',
  'version-tag-prefix': 'tag-version-prefix',
  'version-git-tag': 'git-tag-version',
  'version-commit-hooks': 'commit-hooks',
  'version-git-message': 'message'
};

class YarnRegistry extends (_npmRegistry || _load_npmRegistry()).default {
  constructor(cwd, registries, requestManager, reporter, enableDefaultRc, extraneousRcFiles) {
    super(cwd, registries, requestManager, reporter, enableDefaultRc, extraneousRcFiles);

    this.homeConfigLoc = path.join(userHome, '.yarnrc');
    this.homeConfig = {};
  }

  getOption(key) {
    let val = this.config[key];

    // if this isn't set in a yarn config, then use npm
    if (typeof val === 'undefined') {
      val = this.registries.npm.getOption(npmMap[key]);
    }

    if (typeof val === 'undefined') {
      val = this.registries.npm.getOption(key);
    }

    // if this isn't set in a yarn config or npm config, then use the default (or undefined)
    if (typeof val === 'undefined') {
      val = DEFAULTS[key];
    }

    return val;
  }

  loadConfig() {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const locations = yield _this.getPossibleConfigLocations('yarnrc', _this.reporter);

      for (var _iterator = locations, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
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
        const isHome = _ref[0];
        const loc = _ref[1];
        const file = _ref[2];

        var _parse = (0, (_lockfile || _load_lockfile()).parse)(file, loc);

        const config = _parse.object;


        if (isHome) {
          _this.homeConfig = config;
        }

        for (var _iterator2 = RELATIVE_KEYS, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
          var _ref3;

          if (_isArray2) {
            if (_i2 >= _iterator2.length) break;
            _ref3 = _iterator2[_i2++];
          } else {
            _i2 = _iterator2.next();
            if (_i2.done) break;
            _ref3 = _i2.value;
          }

          const key = _ref3;

          const valueLoc = config[key];

          if (!_this.config[key] && valueLoc) {
            const resolvedLoc = config[key] = path.resolve(path.dirname(loc), valueLoc);

            if (FOLDER_KEY.includes(key)) {
              yield (_fs || _load_fs()).mkdirp(resolvedLoc);
            }
          }
        }

        // merge with any existing environment variables
        const env = config.env;
        if (env) {
          const existingEnv = _this.config.env;
          if (existingEnv) {
            _this.config.env = Object.assign({}, env, existingEnv);
          }
        }

        _this.config = Object.assign({}, config, _this.config);
      }

      // default yarn config
      _this.config = Object.assign({}, DEFAULTS, _this.config);
    })();
  }

  saveHomeConfig(config) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      YarnRegistry.normalizeConfig(config);

      for (const key in config) {
        const val = config[key];

        // if the current config key was taken from home config then update
        // the global config
        if (_this2.homeConfig[key] === _this2.config[key]) {
          _this2.config[key] = val;
        }

        // update just the home config
        _this2.homeConfig[key] = config[key];
      }

      yield (_fs || _load_fs()).writeFilePreservingEol(_this2.homeConfigLoc, `${(0, (_lockfile || _load_lockfile()).stringify)(_this2.homeConfig)}\n`);
    })();
  }
}
exports.default = YarnRegistry;
YarnRegistry.filename = 'yarn.json';