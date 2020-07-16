/* @flow */

import type PackageRequest from '../../package-request.js';
import type {ExplodedFragment} from './hosted-git-resolver.js';
import GitResolver from './git-resolver.js';
import {explodeHostedGitFragment} from './hosted-git-resolver.js';

// NOTE: extend GitResolver rather than HostedGitResolver to normalize resolutions
// and fix https://github.com/yarnpkg/yarn/issues/8238
export default class GitHubResolver extends GitResolver {
  static protocol = 'github';
  static hostname = 'github.com';

  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const exploded = explodeHostedGitFragment(fragment, this.reporter);

    // override url and hash from GitResolver for GitHub/HostedGit specific version patterns
    this.url = this.constructor.getGitHTTPBaseUrl(exploded);
    this.hash = exploded.hash;
  }

  hash: string;
  url: string;

  static isVersion(pattern: string): boolean {
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

  static getTarballUrl(parts: ExplodedFragment, hash: string): string {
    return `https://codeload.${this.hostname}/${parts.user}/${parts.repo}/tar.gz/${hash}`;
  }

  static getGitSSHUrl(parts: ExplodedFragment): string {
    return (
      `git+ssh://git@${this.hostname}/${parts.user}/${parts.repo}.git` +
      `${parts.hash ? '#' + decodeURIComponent(parts.hash) : ''}`
    );
  }

  static getGitHTTPBaseUrl(parts: ExplodedFragment): string {
    return `https://${this.hostname}/${parts.user}/${parts.repo}`;
  }

  static getGitHTTPUrl(parts: ExplodedFragment): string {
    return `${GitHubResolver.getGitHTTPBaseUrl(parts)}.git`;
  }

  static getHTTPFileUrl(parts: ExplodedFragment, filename: string, commit: string): string {
    return `https://raw.githubusercontent.com/${parts.user}/${parts.repo}/${commit}/${filename}`;
  }
}
