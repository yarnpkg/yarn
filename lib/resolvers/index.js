'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hostedGit = exports.registries = undefined;
exports.getExoticResolver = getExoticResolver;
exports.hostedGitFragmentToGitUrl = hostedGitFragmentToGitUrl;

var _baseResolver;

function _load_baseResolver() {
  return _baseResolver = _interopRequireDefault(require('./base-resolver.js'));
}

var _npmResolver;

function _load_npmResolver() {
  return _npmResolver = _interopRequireDefault(require('./registries/npm-resolver.js'));
}

var _yarnResolver;

function _load_yarnResolver() {
  return _yarnResolver = _interopRequireDefault(require('./registries/yarn-resolver.js'));
}

var _gitResolver;

function _load_gitResolver() {
  return _gitResolver = _interopRequireDefault(require('./exotics/git-resolver.js'));
}

var _tarballResolver;

function _load_tarballResolver() {
  return _tarballResolver = _interopRequireDefault(require('./exotics/tarball-resolver.js'));
}

var _githubResolver;

function _load_githubResolver() {
  return _githubResolver = _interopRequireDefault(require('./exotics/github-resolver.js'));
}

var _fileResolver;

function _load_fileResolver() {
  return _fileResolver = _interopRequireDefault(require('./exotics/file-resolver.js'));
}

var _linkResolver;

function _load_linkResolver() {
  return _linkResolver = _interopRequireDefault(require('./exotics/link-resolver.js'));
}

var _gitlabResolver;

function _load_gitlabResolver() {
  return _gitlabResolver = _interopRequireDefault(require('./exotics/gitlab-resolver.js'));
}

var _gistResolver;

function _load_gistResolver() {
  return _gistResolver = _interopRequireDefault(require('./exotics/gist-resolver.js'));
}

var _bitbucketResolver;

function _load_bitbucketResolver() {
  return _bitbucketResolver = _interopRequireDefault(require('./exotics/bitbucket-resolver.js'));
}

var _hostedGitResolver;

function _load_hostedGitResolver() {
  return _hostedGitResolver = require('./exotics/hosted-git-resolver.js');
}

var _registryResolver;

function _load_registryResolver() {
  return _registryResolver = _interopRequireDefault(require('./exotics/registry-resolver.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const registries = exports.registries = {
  npm: (_npmResolver || _load_npmResolver()).default,
  yarn: (_yarnResolver || _load_yarnResolver()).default
};

//

const exotics = new Set([(_gitResolver || _load_gitResolver()).default, (_tarballResolver || _load_tarballResolver()).default, (_githubResolver || _load_githubResolver()).default, (_fileResolver || _load_fileResolver()).default, (_linkResolver || _load_linkResolver()).default, (_gitlabResolver || _load_gitlabResolver()).default, (_gistResolver || _load_gistResolver()).default, (_bitbucketResolver || _load_bitbucketResolver()).default]);

function getExoticResolver(pattern) {
  for (var _iterator = exotics, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    const Resolver = _ref;

    if (Resolver.isVersion(pattern)) {
      return Resolver;
    }
  }
  return null;
}

//

const hostedGit = exports.hostedGit = {
  github: (_githubResolver || _load_githubResolver()).default,
  gitlab: (_gitlabResolver || _load_gitlabResolver()).default,
  bitbucket: (_bitbucketResolver || _load_bitbucketResolver()).default
};

function hostedGitFragmentToGitUrl(fragment, reporter) {
  for (const key in hostedGit) {
    const Resolver = hostedGit[key];
    if (Resolver.isVersion(fragment)) {
      return Resolver.getGitHTTPUrl((0, (_hostedGitResolver || _load_hostedGitResolver()).explodeHostedGitFragment)(fragment, reporter));
    }
  }

  return fragment;
}

//

for (const key in registries) {
  var _class, _temp;

  const RegistryResolver = registries[key];

  exotics.add((_temp = _class = class extends (_registryResolver || _load_registryResolver()).default {}, _class.protocol = key, _class.factory = RegistryResolver, _temp));
}