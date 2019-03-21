'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _hostedGitResolver;

function _load_hostedGitResolver() {
  return _hostedGitResolver = _interopRequireDefault(require('./hosted-git-resolver.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class GitLabResolver extends (_hostedGitResolver || _load_hostedGitResolver()).default {

  static getTarballUrl(parts, hash) {
    return `https://${this.hostname}/${parts.user}/${parts.repo}/repository/archive.tar.gz?ref=${hash}`;
  }

  static getGitHTTPBaseUrl(parts) {
    return `https://${this.hostname}/${parts.user}/${parts.repo}`;
  }

  static getGitHTTPUrl(parts) {
    return `${GitLabResolver.getGitHTTPBaseUrl(parts)}.git`;
  }

  static getGitSSHUrl(parts) {
    return `git+ssh://git@${this.hostname}/${parts.user}/${parts.repo}.git` + `${parts.hash ? '#' + decodeURIComponent(parts.hash) : ''}`;
  }

  static getHTTPFileUrl(parts, filename, commit) {
    return `https://${this.hostname}/${parts.user}/${parts.repo}/raw/${commit}/${filename}`;
  }
}
exports.default = GitLabResolver;
GitLabResolver.hostname = 'gitlab.com';
GitLabResolver.protocol = 'gitlab';