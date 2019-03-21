'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

exports.explodeHostedGitFragment = explodeHostedGitFragment;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _index;

function _load_index() {
  return _index = require('../../registries/index.js');
}

var _gitResolver;

function _load_gitResolver() {
  return _gitResolver = _interopRequireDefault(require('./git-resolver.js'));
}

var _exoticResolver;

function _load_exoticResolver() {
  return _exoticResolver = _interopRequireDefault(require('./exotic-resolver.js'));
}

var _git;

function _load_git() {
  return _git = _interopRequireDefault(require('../../util/git.js'));
}

var _guessName;

function _load_guessName() {
  return _guessName = _interopRequireDefault(require('../../util/guess-name.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parseHash(fragment) {
  const hashPosition = fragment.indexOf('#');
  return hashPosition === -1 ? '' : fragment.substr(hashPosition + 1);
}

function explodeHostedGitFragment(fragment, reporter) {
  const hash = parseHash(fragment);

  const preParts = fragment.split('@');
  if (preParts.length > 2) {
    fragment = preParts[1] + '@' + preParts[2];
  }

  const parts = fragment.replace(/(.*?)#.*/, '$1') // Strip hash
  .replace(/.*:(.*)/, '$1') // Strip prefixed protocols
  .replace(/.git$/, '') // Strip the .git suffix
  .split('/');

  const user = parts[parts.length - 2];
  const repo = parts[parts.length - 1];

  if (user === undefined || repo === undefined) {
    throw new (_errors || _load_errors()).MessageError(reporter.lang('invalidHostedGitFragment', fragment));
  }

  return {
    user,
    repo,
    hash
  };
}

class HostedGitResolver extends (_exoticResolver || _load_exoticResolver()).default {
  constructor(request, fragment) {
    super(request, fragment);

    const exploded = this.exploded = explodeHostedGitFragment(fragment, this.reporter);
    const user = exploded.user,
          repo = exploded.repo,
          hash = exploded.hash;

    this.user = user;
    this.repo = repo;
    this.hash = hash;
  }

  static getTarballUrl(exploded, commit) {
    exploded;
    commit;
    throw new Error('Not implemented');
  }

  static getGitHTTPUrl(exploded) {
    exploded;
    throw new Error('Not implemented');
  }

  static getGitHTTPBaseUrl(exploded) {
    exploded;
    throw new Error('Not implemented');
  }

  static getGitSSHUrl(exploded) {
    exploded;
    throw new Error('Not implemented');
  }

  static getHTTPFileUrl(exploded, filename, commit) {
    exploded;
    filename;
    commit;
    throw new Error('Not implemented');
  }

  getRefOverHTTP(url) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const gitUrl = (_git || _load_git()).default.npmUrlToGitUrl(url);
      const client = new (_git || _load_git()).default(_this.config, gitUrl, _this.hash);

      let out = yield _this.config.requestManager.request({
        url: `${url}/info/refs?service=git-upload-pack`,
        queue: _this.resolver.fetchingQueue
      });

      if (out) {
        // clean up output
        let lines = out.trim().split('\n');

        // remove first two lines which contains compatibility info etc
        lines = lines.slice(2);

        // remove last line which contains the terminator "0000"
        lines.pop();

        // remove line lengths from start of each line
        lines = lines.map(function (line) {
          return line.slice(4);
        });

        out = lines.join('\n');
      } else {
        throw new Error(_this.reporter.lang('hostedGitResolveError'));
      }

      return client.setRefHosted(out);
    })();
  }

  resolveOverHTTP(url) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const commit = yield _this2.getRefOverHTTP(url);
      const config = _this2.config;


      const tarballUrl = _this2.constructor.getTarballUrl(_this2.exploded, commit);

      const tryRegistry = (() => {
        var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (registry) {
          const filename = (_index || _load_index()).registries[registry].filename;

          const href = _this2.constructor.getHTTPFileUrl(_this2.exploded, filename, commit);
          const file = yield config.requestManager.request({
            url: href,
            queue: _this2.resolver.fetchingQueue
          });
          if (!file) {
            return null;
          }

          const json = yield config.readJson(href, function () {
            return JSON.parse(file);
          });
          json._uid = commit;
          json._remote = {
            resolved: tarballUrl,
            type: 'tarball',
            reference: tarballUrl,
            registry
          };
          return json;
        });

        return function tryRegistry(_x) {
          return _ref.apply(this, arguments);
        };
      })();

      const file = yield tryRegistry(_this2.registry);
      if (file) {
        return file;
      }

      for (const registry in (_index || _load_index()).registries) {
        if (registry === _this2.registry) {
          continue;
        }

        const file = yield tryRegistry(registry);
        if (file) {
          return file;
        }
      }

      return {
        name: (0, (_guessName || _load_guessName()).default)(url),
        version: '0.0.0',
        _uid: commit,
        _remote: {
          resolved: tarballUrl,
          type: 'tarball',
          reference: tarballUrl,
          registry: 'npm',
          hash: undefined
        }
      };
    })();
  }

  hasHTTPCapability(url) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      return (yield _this3.config.requestManager.request({
        url,
        method: 'HEAD',
        queue: _this3.resolver.fetchingQueue,
        followRedirect: false
      })) !== false;
    })();
  }

  resolve() {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // If we already have the tarball, just return it without having to make any HTTP requests.
      const shrunk = _this4.request.getLocked('tarball');
      if (shrunk) {
        return shrunk;
      }

      const httpUrl = _this4.constructor.getGitHTTPUrl(_this4.exploded);
      const httpBaseUrl = _this4.constructor.getGitHTTPBaseUrl(_this4.exploded);
      const sshUrl = _this4.constructor.getGitSSHUrl(_this4.exploded);

      // If we can access the files over HTTP then we should as it's MUCH faster than git
      // archive and tarball unarchiving. The HTTP API is only available for public repos
      // though.
      if (yield _this4.hasHTTPCapability(httpBaseUrl)) {
        return _this4.resolveOverHTTP(httpUrl);
      }

      // If the url is accessible over git archive then we should immediately delegate to
      // the git resolver.
      //
      // NOTE: Here we use a different url than when we delegate to the git resolver later on.
      // This is because `git archive` requires access over ssh and github only allows that
      // if you have write permissions
      const sshGitUrl = (_git || _load_git()).default.npmUrlToGitUrl(sshUrl);
      if (yield (_git || _load_git()).default.hasArchiveCapability(sshGitUrl)) {
        const archiveClient = new (_git || _load_git()).default(_this4.config, sshGitUrl, _this4.hash);
        const commit = yield archiveClient.init();
        return _this4.fork((_gitResolver || _load_gitResolver()).default, true, `${sshUrl}#${commit}`);
      }

      // fallback to the plain git resolver
      return _this4.fork((_gitResolver || _load_gitResolver()).default, true, sshUrl);
    })();
  }
}
exports.default = HostedGitResolver;