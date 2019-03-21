'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SCOPE_SEPARATOR = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _constants;

function _load_constants() {
  return _constants = require('../constants.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../util/fs.js'));
}

var _npmResolver;

function _load_npmResolver() {
  return _npmResolver = _interopRequireDefault(require('../resolvers/registries/npm-resolver.js'));
}

var _envReplace;

function _load_envReplace() {
  return _envReplace = _interopRequireDefault(require('../util/env-replace.js'));
}

var _baseRegistry;

function _load_baseRegistry() {
  return _baseRegistry = _interopRequireDefault(require('./base-registry.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('../util/misc');
}

var _path;

function _load_path() {
  return _path = require('../util/path');
}

var _normalizeUrl;

function _load_normalizeUrl() {
  return _normalizeUrl = _interopRequireDefault(require('normalize-url'));
}

var _userHomeDir;

function _load_userHomeDir() {
  return _userHomeDir = _interopRequireDefault(require('../util/user-home-dir'));
}

var _userHomeDir2;

function _load_userHomeDir2() {
  return _userHomeDir2 = require('../util/user-home-dir');
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _login;

function _load_login() {
  return _login = require('../cli/commands/login.js');
}

var _path2;

function _load_path2() {
  return _path2 = _interopRequireDefault(require('path'));
}

var _url;

function _load_url() {
  return _url = _interopRequireDefault(require('url'));
}

var _ini;

function _load_ini() {
  return _ini = _interopRequireDefault(require('ini'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
const REGEX_REGISTRY_HTTP_PROTOCOL = /^https?:/i;
const REGEX_REGISTRY_PREFIX = /^(https?:)?\/\//i;
const REGEX_REGISTRY_SUFFIX = /registry\/?$/;

const SCOPE_SEPARATOR = exports.SCOPE_SEPARATOR = '%2f';
// All scoped package names are of the format `@scope%2fpkg` from the use of NpmRegistry.escapeName
// `(?:^|\/)` Match either the start of the string or a `/` but don't capture
// `[^\/?]+?` Match any character that is not '/' or '?' and capture, up until the first occurrence of:
// `(?=%2f|\/)` Match SCOPE_SEPARATOR, the escaped '/', or a raw `/` and don't capture
// The reason for matching a plain `/` is NPM registry being inconsistent about escaping `/` in
// scoped package names: when you're fetching a tarball, it is not escaped, when you want info
// about the package, it is escaped.
const SCOPED_PKG_REGEXP = /(?:^|\/)(@[^\/?]+?)(?=%2f|\/)/;

// TODO: Use the method from src/cli/commands/global.js for this instead
function getGlobalPrefix() {
  if (process.env.PREFIX) {
    return process.env.PREFIX;
  } else if (process.platform === 'win32') {
    // c:\node\node.exe --> prefix=c:\node\
    return (_path2 || _load_path2()).default.dirname(process.execPath);
  } else {
    // /usr/local/bin/node --> prefix=/usr/local
    let prefix = (_path2 || _load_path2()).default.dirname((_path2 || _load_path2()).default.dirname(process.execPath));

    // destdir only is respected on Unix
    if (process.env.DESTDIR) {
      prefix = (_path2 || _load_path2()).default.join(process.env.DESTDIR, prefix);
    }

    return prefix;
  }
}

const PATH_CONFIG_OPTIONS = new Set(['cache', 'cafile', 'prefix', 'userconfig']);

function isPathConfigOption(key) {
  return PATH_CONFIG_OPTIONS.has(key);
}

function normalizePath(val) {
  if (val === undefined) {
    return undefined;
  }

  if (typeof val !== 'string') {
    val = String(val);
  }

  return (0, (_path || _load_path()).resolveWithHome)(val);
}

function urlParts(requestUrl) {
  const normalizedUrl = (0, (_normalizeUrl || _load_normalizeUrl()).default)(requestUrl);
  const parsed = (_url || _load_url()).default.parse(normalizedUrl);
  const host = parsed.host || '';
  const path = parsed.path || '';
  return { host, path };
}

class NpmRegistry extends (_baseRegistry || _load_baseRegistry()).default {
  constructor(cwd, registries, requestManager, reporter, enableDefaultRc, extraneousRcFiles) {
    super(cwd, registries, requestManager, reporter, enableDefaultRc, extraneousRcFiles);
    this.folder = 'node_modules';
  }

  static escapeName(name) {
    // scoped packages contain slashes and the npm registry expects them to be escaped
    return name.replace('/', SCOPE_SEPARATOR);
  }

  isScopedPackage(packageIdent) {
    return SCOPED_PKG_REGEXP.test(packageIdent);
  }

  getRequestUrl(registry, pathname) {
    const isUrl = REGEX_REGISTRY_PREFIX.test(pathname);

    if (isUrl) {
      return pathname;
    } else {
      return (_url || _load_url()).default.resolve((0, (_misc || _load_misc()).addSuffix)(registry, '/'), pathname);
    }
  }

  isRequestToRegistry(requestUrl, registryUrl) {
    const request = urlParts(requestUrl);
    const registry = urlParts(registryUrl);
    const customHostSuffix = this.getRegistryOrGlobalOption(registryUrl, 'custom-host-suffix');

    const requestToRegistryHost = request.host === registry.host;
    const requestToYarn = (_constants || _load_constants()).YARN_REGISTRY.includes(request.host) && DEFAULT_REGISTRY.includes(registry.host);
    const requestToRegistryPath = request.path.startsWith(registry.path);
    // For some registries, the package path does not prefix with the registry path
    const customHostSuffixInUse = typeof customHostSuffix === 'string' && request.host.endsWith(customHostSuffix);

    return (requestToRegistryHost || requestToYarn) && (requestToRegistryPath || customHostSuffixInUse);
  }

  request(pathname, opts = {}, packageName) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // packageName needs to be escaped when if it is passed
      const packageIdent = packageName && NpmRegistry.escapeName(packageName) || pathname;
      const registry = opts.registry || _this.getRegistry(packageIdent);
      const requestUrl = _this.getRequestUrl(registry, pathname);

      const alwaysAuth = _this.getRegistryOrGlobalOption(registry, 'always-auth');

      const headers = (0, (_extends2 || _load_extends()).default)({
        Accept:
        // This is to use less bandwidth unless we really need to get the full response.
        // See https://github.com/npm/npm-registry-client#requests
        opts.unfiltered ? 'application/json' : 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'
      }, opts.headers);

      const isToRegistry = _this.isRequestToRegistry(requestUrl, registry) || _this.requestNeedsAuth(requestUrl);

      // this.token must be checked to account for publish requests on non-scoped packages
      if (_this.token || isToRegistry && (alwaysAuth || _this.isScopedPackage(packageIdent))) {
        const authorization = _this.getAuth(packageIdent);
        if (authorization) {
          headers.authorization = authorization;
        }
      }

      if (_this.otp) {
        headers['npm-otp'] = _this.otp;
      }

      try {
        return yield _this.requestManager.request({
          url: requestUrl,
          method: opts.method,
          body: opts.body,
          auth: opts.auth,
          headers,
          json: !opts.buffer,
          buffer: opts.buffer,
          process: opts.process,
          gzip: true
        });
      } catch (error) {
        if (error instanceof (_errors || _load_errors()).OneTimePasswordError) {
          if (_this.otp) {
            throw new (_errors || _load_errors()).MessageError(_this.reporter.lang('incorrectOneTimePassword'));
          }

          _this.reporter.info(_this.reporter.lang('twoFactorAuthenticationEnabled'));
          _this.otp = yield (0, (_login || _load_login()).getOneTimePassword)(_this.reporter);

          _this.requestManager.clearCache();

          return _this.request(pathname, opts, packageName);
        } else {
          throw error;
        }
      }
    })();
  }

  requestNeedsAuth(requestUrl) {
    const config = this.config;
    const requestParts = urlParts(requestUrl);
    return !!Object.keys(config).find(option => {
      const parts = option.split(':');
      if (parts.length === 2 && parts[1] === '_authToken' || parts[1] === '_password') {
        const registryParts = urlParts(parts[0]);
        if (requestParts.host === registryParts.host && requestParts.path.startsWith(registryParts.path)) {
          return true;
        }
      }
      return false;
    });
  }

  checkOutdated(config, name, range) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const escapedName = NpmRegistry.escapeName(name);
      const req = yield _this2.request(escapedName, { unfiltered: true });
      if (!req) {
        throw new Error(`couldn't find ${name}`);
      }

      // By default use top level 'repository' and 'homepage' values
      let repository = req.repository,
          homepage = req.homepage;

      const wantedPkg = yield (_npmResolver || _load_npmResolver()).default.findVersionInRegistryResponse(config, escapedName, range, req);

      // But some local repositories like Verdaccio do not return 'repository' nor 'homepage'
      // in top level data structure, so we fallback to wanted package manifest
      if (!repository && !homepage) {
        repository = wantedPkg.repository;
        homepage = wantedPkg.homepage;
      }

      let latest = req['dist-tags'].latest;
      // In certain cases, registries do not return a 'latest' tag.
      if (!latest) {
        latest = wantedPkg.version;
      }

      const url = homepage || repository && repository.url || '';

      return {
        latest,
        wanted: wantedPkg.version,
        url
      };
    })();
  }

  getPossibleConfigLocations(filename, reporter) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let possibles = [];

      for (var _iterator = _this3.extraneousRcFiles.slice().reverse(), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        const rcFile = _ref;

        possibles.push([false, (_path2 || _load_path2()).default.resolve(process.cwd(), rcFile)]);
      }

      if (_this3.enableDefaultRc) {
        // npmrc --> ./.npmrc, ~/.npmrc, ${prefix}/etc/npmrc
        const localfile = '.' + filename;
        possibles = possibles.concat([[false, (_path2 || _load_path2()).default.join(_this3.cwd, localfile)], [true, _this3.config.userconfig || (_path2 || _load_path2()).default.join((_userHomeDir || _load_userHomeDir()).default, localfile)], [false, (_path2 || _load_path2()).default.join(getGlobalPrefix(), 'etc', filename)]]);

        // When home directory for global install is different from where $HOME/npmrc is stored,
        // E.g. /usr/local/share vs /root on linux machines, check the additional location
        if ((_userHomeDir2 || _load_userHomeDir2()).home !== (_userHomeDir || _load_userHomeDir()).default) {
          possibles.push([true, (_path2 || _load_path2()).default.join((_userHomeDir2 || _load_userHomeDir2()).home, localfile)]);
        }

        // npmrc --> ../.npmrc, ../../.npmrc, etc.
        const foldersFromRootToCwd = (0, (_path || _load_path()).getPosixPath)(_this3.cwd).split('/');
        while (foldersFromRootToCwd.length > 1) {
          possibles.push([false, (_path2 || _load_path2()).default.join(foldersFromRootToCwd.join((_path2 || _load_path2()).default.sep), localfile)]);
          foldersFromRootToCwd.pop();
        }
      }

      const actuals = [];
      for (var _iterator2 = possibles, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const _ref2 = _ref3;
        const isHome = _ref2[0];
        const loc = _ref2[1];

        reporter.verbose(reporter.lang('configPossibleFile', loc));
        if (yield (_fs || _load_fs()).exists(loc)) {
          reporter.verbose(reporter.lang('configFileFound', loc));
          actuals.push([isHome, loc, yield (_fs || _load_fs()).readFile(loc)]);
        }
      }

      return actuals;
    })();
  }

  static getConfigEnv(env = process.env) {
    // To match NPM's behavior, HOME is always the user's home directory.
    const overrideEnv = {
      HOME: (_userHomeDir2 || _load_userHomeDir2()).home
    };
    return Object.assign({}, env, overrideEnv);
  }

  static normalizeConfig(config) {
    const env = NpmRegistry.getConfigEnv();
    config = (_baseRegistry || _load_baseRegistry()).default.normalizeConfig(config);

    for (const key in config) {
      config[key] = (0, (_envReplace || _load_envReplace()).default)(config[key], env);
      if (isPathConfigOption(key)) {
        config[key] = normalizePath(config[key]);
      }
    }

    return config;
  }

  loadConfig() {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // docs: https://docs.npmjs.com/misc/config
      _this4.mergeEnv('npm_config_');

      for (var _iterator3 = yield _this4.getPossibleConfigLocations('npmrc', _this4.reporter), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref5;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref5 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref5 = _i3.value;
        }

        const _ref4 = _ref5;
        const loc = _ref4[1];
        const file = _ref4[2];

        const config = NpmRegistry.normalizeConfig((_ini || _load_ini()).default.parse(file));

        // normalize offline mirror path relative to the current npmrc
        const offlineLoc = config['yarn-offline-mirror'];
        // don't normalize if we already have a mirror path
        if (!_this4.config['yarn-offline-mirror'] && offlineLoc) {
          const mirrorLoc = config['yarn-offline-mirror'] = (_path2 || _load_path2()).default.resolve((_path2 || _load_path2()).default.dirname(loc), offlineLoc);
          yield (_fs || _load_fs()).mkdirp(mirrorLoc);
        }

        _this4.config = Object.assign({}, config, _this4.config);
      }
    })();
  }

  getScope(packageIdent) {
    const match = packageIdent.match(SCOPED_PKG_REGEXP);
    return match && match[1] || '';
  }

  getRegistry(packageIdent) {
    // Try extracting registry from the url, then scoped registry, and default registry
    if (packageIdent.match(REGEX_REGISTRY_PREFIX)) {
      const availableRegistries = this.getAvailableRegistries();
      const registry = availableRegistries.find(registry => packageIdent.startsWith(registry));
      if (registry) {
        return String(registry);
      }
    }

    var _arr = [this.getScope(packageIdent), ''];
    for (var _i4 = 0; _i4 < _arr.length; _i4++) {
      const scope = _arr[_i4];
      const registry = this.getScopedOption(scope, 'registry') || this.registries.yarn.getScopedOption(scope, 'registry');
      if (registry) {
        return String(registry);
      }
    }

    return DEFAULT_REGISTRY;
  }

  getAuthByRegistry(registry) {
    // Check for bearer token.
    const authToken = this.getRegistryOrGlobalOption(registry, '_authToken');
    if (authToken) {
      return `Bearer ${String(authToken)}`;
    }

    // Check for basic auth token.
    const auth = this.getRegistryOrGlobalOption(registry, '_auth');
    if (auth) {
      return `Basic ${String(auth)}`;
    }

    // Check for basic username/password auth.
    const username = this.getRegistryOrGlobalOption(registry, 'username');
    const password = this.getRegistryOrGlobalOption(registry, '_password');
    if (username && password) {
      const pw = Buffer.from(String(password), 'base64').toString();
      return 'Basic ' + Buffer.from(String(username) + ':' + pw).toString('base64');
    }

    return '';
  }

  getAuth(packageIdent) {
    if (this.token) {
      return this.token;
    }

    const baseRegistry = this.getRegistry(packageIdent);
    const registries = [baseRegistry];

    // If sending a request to the Yarn registry, we must also send it the auth token for the npm registry
    if (baseRegistry === (_constants || _load_constants()).YARN_REGISTRY) {
      registries.push(DEFAULT_REGISTRY);
    }

    for (var _iterator4 = registries, _isArray4 = Array.isArray(_iterator4), _i5 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref6;

      if (_isArray4) {
        if (_i5 >= _iterator4.length) break;
        _ref6 = _iterator4[_i5++];
      } else {
        _i5 = _iterator4.next();
        if (_i5.done) break;
        _ref6 = _i5.value;
      }

      const registry = _ref6;

      const auth = this.getAuthByRegistry(registry);

      if (auth) {
        return auth;
      }
    }

    return '';
  }

  getScopedOption(scope, option) {
    return this.getOption(scope + (scope ? ':' : '') + option);
  }

  getRegistryOption(registry, option) {
    const pre = REGEX_REGISTRY_HTTP_PROTOCOL;
    const suf = REGEX_REGISTRY_SUFFIX;

    // When registry is used config scope, the trailing '/' is required
    const reg = (0, (_misc || _load_misc()).addSuffix)(registry, '/');

    // 1st attempt, try to get option for the given registry URL
    // 2nd attempt, remove the 'https?:' prefix of the registry URL
    // 3nd attempt, remove the 'registry/?' suffix of the registry URL
    return this.getScopedOption(reg, option) || pre.test(reg) && this.getRegistryOption(reg.replace(pre, ''), option) || suf.test(reg) && this.getRegistryOption(reg.replace(suf, ''), option);
  }

  getRegistryOrGlobalOption(registry, option) {
    return this.getRegistryOption(registry, option) || this.getOption(option);
  }
}
exports.default = NpmRegistry;
NpmRegistry.filename = 'package.json';