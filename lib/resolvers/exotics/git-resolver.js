'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _index;

function _load_index() {
  return _index = require('../index.js');
}

var _misc;

function _load_misc() {
  return _misc = _interopRequireWildcard(require('../../util/misc.js'));
}

var _version;

function _load_version() {
  return _version = _interopRequireWildcard(require('../../util/version.js'));
}

var _guessName;

function _load_guessName() {
  return _guessName = _interopRequireDefault(require('../../util/guess-name.js'));
}

var _index2;

function _load_index2() {
  return _index2 = require('../../registries/index.js');
}

var _exoticResolver;

function _load_exoticResolver() {
  return _exoticResolver = _interopRequireDefault(require('./exotic-resolver.js'));
}

var _git;

function _load_git() {
  return _git = _interopRequireDefault(require('../../util/git.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const urlParse = require('url').parse;

const GIT_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.com', 'bitbucket.org'];

const GIT_PATTERN_MATCHERS = [/^git:/, /^git\+.+:/, /^ssh:/, /^https?:.+\.git$/, /^https?:.+\.git#.+/];

class GitResolver extends (_exoticResolver || _load_exoticResolver()).default {
  constructor(request, fragment) {
    super(request, fragment);

    var _versionUtil$explodeH = (_version || _load_version()).explodeHashedUrl(fragment);

    const url = _versionUtil$explodeH.url,
          hash = _versionUtil$explodeH.hash;

    this.url = url;
    this.hash = hash;
  }

  static isVersion(pattern) {
    for (var _iterator = GIT_PATTERN_MATCHERS, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const matcher = _ref;

      if (matcher.test(pattern)) {
        return true;
      }
    }

    var _urlParse = urlParse(pattern);

    const hostname = _urlParse.hostname,
          path = _urlParse.path;

    if (hostname && path && GIT_HOSTS.indexOf(hostname) >= 0) {
      // only if dependency is pointing to a git repo,
      // e.g. facebook/flow and not file in a git repo facebook/flow/archive/v1.0.0.tar.gz
      return path.split('/').filter(p => !!p).length === 2;
    }

    return false;
  }

  resolve(forked) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let tryRegistry = (() => {
        var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (registry) {
          const filename = (_index2 || _load_index2()).registries[registry].filename;

          const file = yield client.getFile(filename);
          if (!file) {
            return null;
          }

          const json = yield config.readJson(`${url}/${filename}`, function () {
            return JSON.parse(file);
          });
          json._uid = commit;
          json._remote = {
            resolved: `${url}#${commit}`,
            type: 'git',
            reference: url,
            hash: commit,
            registry
          };
          return json;
        });

        return function tryRegistry(_x) {
          return _ref2.apply(this, arguments);
        };
      })();

      const url = _this.url;

      // shortcut for hosted git. we will fallback to a GitResolver if the hosted git
      // optimisations fail which the `forked` flag indicates so we don't get into an
      // infinite loop

      const parts = urlParse(url);
      if (false && !forked && !parts.auth && parts.pathname) {
        // check if this git url uses any of the hostnames defined in our hosted git resolvers
        for (const name in (_index || _load_index()).hostedGit) {
          const Resolver = (_index || _load_index()).hostedGit[name];
          if (Resolver.hostname !== parts.hostname) {
            continue;
          }

          // we have a match! clean up the pathname of url artifacts
          let pathname = parts.pathname;
          pathname = (_misc || _load_misc()).removePrefix(pathname, '/'); // remove prefixed slash
          pathname = (_misc || _load_misc()).removeSuffix(pathname, '.git'); // remove .git suffix if present

          const url = `${pathname}${_this.hash ? '#' + decodeURIComponent(_this.hash) : ''}`;
          return _this.fork(Resolver, false, url);
        }
      }

      // get from lockfile
      const shrunk = _this.request.getLocked('git');
      if (shrunk) {
        return shrunk;
      }

      const config = _this.config;


      const gitUrl = (_git || _load_git()).default.npmUrlToGitUrl(url);
      const client = new (_git || _load_git()).default(config, gitUrl, _this.hash);
      const commit = yield client.init();

      const file = yield tryRegistry(_this.registry);
      if (file) {
        return file;
      }

      for (const registry in (_index2 || _load_index2()).registries) {
        if (registry === _this.registry) {
          continue;
        }

        const file = yield tryRegistry(registry);
        if (file) {
          return file;
        }
      }

      return {
        // This is just the default, it can be overridden with key of dependencies
        name: (0, (_guessName || _load_guessName()).default)(url),
        version: '0.0.0',
        _uid: commit,
        _remote: {
          resolved: `${url}#${commit}`,
          type: 'git',
          reference: url,
          hash: commit,
          registry: 'npm'
        }
      };
    })();
  }
}
exports.default = GitResolver;