'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _misc;

function _load_misc() {
  return _misc = require('../util/misc.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const objectPath = require('object-path');

const path = require('path');

class BaseRegistry {
  constructor(cwd, registries, requestManager, reporter, enableDefaultRc, extraneousRcFiles) {
    this.reporter = reporter;
    this.requestManager = requestManager;
    this.registries = registries;
    this.config = {};
    this.folder = '';
    this.token = '';
    this.loc = '';
    this.cwd = cwd;
    this.enableDefaultRc = enableDefaultRc;
    this.extraneousRcFiles = extraneousRcFiles;
  }

  // the filename to use for package metadata


  //


  //

  //


  //


  //


  //


  //


  //


  // absolute folder name to insert modules


  // relative folder name to put these modules


  setToken(token) {
    this.token = token;
  }

  setOtp(otp) {
    this.otp = otp;
  }

  getOption(key) {
    return this.config[key];
  }

  getAvailableRegistries() {
    const config = this.config;
    return Object.keys(config).reduce((registries, option) => {
      if (option === 'registry' || option.split(':')[1] === 'registry') {
        registries.push(config[option]);
      }
      return registries;
    }, []);
  }

  loadConfig() {
    return Promise.resolve();
  }

  checkOutdated(config, name, range) {
    return Promise.reject(new Error('unimplemented'));
  }

  saveHomeConfig(config) {
    return Promise.reject(new Error('unimplemented'));
  }

  request(pathname, opts = {}) {
    return this.requestManager.request((0, (_extends2 || _load_extends()).default)({
      url: pathname
    }, opts));
  }

  init(overrides = {}) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this.mergeEnv('yarn_');
      yield _this.loadConfig();

      for (var _iterator = Object.keys(overrides), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        const override = _ref;

        const val = overrides[override];

        if (val !== undefined) {
          _this.config[override] = val;
        }
      }
      _this.loc = path.join(_this.cwd, _this.folder);
    })();
  }

  static normalizeConfig(config) {
    for (const key in config) {
      config[key] = BaseRegistry.normalizeConfigOption(config[key]);
    }
    return config;
  }

  static normalizeConfigOption(val) {
    if (val === 'true') {
      return true;
    } else if (val === 'false') {
      return false;
    } else {
      return val;
    }
  }

  mergeEnv(prefix) {
    // try environment variables
    for (const envKey in process.env) {
      let key = envKey.toLowerCase();

      // only accept keys prefixed with the prefix
      if (key.indexOf(prefix.toLowerCase()) !== 0) {
        continue;
      }

      const val = BaseRegistry.normalizeConfigOption(process.env[envKey]);

      // remove config prefix
      key = (0, (_misc || _load_misc()).removePrefix)(key, prefix.toLowerCase());

      // replace dunders with dots
      key = key.replace(/__/g, '.');

      // replace underscores with dashes ignoring keys that start with an underscore
      key = key.replace(/([^_])_/g, '$1-');

      // set it via a path
      objectPath.set(this.config, key, val);
    }
  }
}
exports.default = BaseRegistry;