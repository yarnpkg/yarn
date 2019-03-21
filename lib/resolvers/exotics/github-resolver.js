'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _hostedGitResolver;

function _load_hostedGitResolver() {
  return _hostedGitResolver = _interopRequireDefault(require('./hosted-git-resolver.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class GitHubResolver extends (_hostedGitResolver || _load_hostedGitResolver()).default {

  static isVersion(pattern) {
    // github proto
    if (pattern.startsWith('github:')) {
      return true;
    }

    // github shorthand
    if (/^[^:@%/\s.-][^:@%/\s]*[/][^:@\s/%]+(?:#.*)?$/.test(pattern)) {
      return true;
    }

    return false;
  }

  static getTarballUrl(parts, hash) {
    return `https://codeload.${this.hostname}/${parts.user}/${parts.repo}/tar.gz/${hash}`;
  }

  static getGitSSHUrl(parts) {
    return `git+ssh://git@${this.hostname}/${parts.user}/${parts.repo}.git` + `${parts.hash ? '#' + decodeURIComponent(parts.hash) : ''}`;
  }

  static getGitHTTPBaseUrl(parts) {
    return `https://${this.hostname}/${parts.user}/${parts.repo}`;
  }

  static getGitHTTPUrl(parts) {
    return `${GitHubResolver.getGitHTTPBaseUrl(parts)}.git`;
  }

  static getHTTPFileUrl(parts, filename, commit) {
    return `https://raw.githubusercontent.com/${parts.user}/${parts.repo}/${commit}/${filename}`;
  }
}
exports.default = GitHubResolver;
GitHubResolver.protocol = 'github';
GitHubResolver.hostname = 'github.com';