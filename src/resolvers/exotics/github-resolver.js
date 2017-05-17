/* @flow */

import type {ExplodedFragment} from './hosted-git-resolver.js';
import HostedGitResolver from './hosted-git-resolver.js';

export default class GitHubResolver extends HostedGitResolver {
  static protocol = 'github';
  static hostname = 'github.com';

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
