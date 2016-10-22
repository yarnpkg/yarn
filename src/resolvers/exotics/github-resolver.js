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
    return `https://codeload.github.com/${parts.user}/${parts.repo}/tar.gz/${hash}`;
  }

  static getGitSSHUrl(parts: ExplodedFragment): string {
    return `git@github.com:${parts.user}/${parts.repo}.git${parts.hash ? '#' + decodeURIComponent(parts.hash) : ''}`;
  }

  static getGitHTTPUrl(parts: ExplodedFragment): string {
    return `https://github.com/${parts.user}/${parts.repo}.git`;
  }

  static getHTTPFileUrl(parts: ExplodedFragment, filename: string, commit: string): string {
    return `https://raw.githubusercontent.com/${parts.user}/${parts.repo}/${commit}/${filename}`;
  }
}
