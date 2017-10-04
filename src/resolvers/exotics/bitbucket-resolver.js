/* @flow */

import type {ExplodedFragment} from './hosted-git-resolver.js';
import HostedGitResolver from './hosted-git-resolver.js';

export default class BitbucketResolver extends HostedGitResolver {
  static hostname = 'bitbucket.org';
  static protocol = 'bitbucket';

  static isVersion(pattern: string): boolean {
    // bitbucket proto
    if (pattern.startsWith('bitbucket:')) {
      return true;
    }

    // bitbucket shorthand
    if (/^[^:@%/\s.-][^:@%/\s]*[/][^:@\s/%]+(?:#.*)?$/.test(pattern)) {
      return true;
    }

    return false;
  }

  static getTarballUrl(parts: ExplodedFragment, hash: string): string {
    return `https://${this.hostname}/${parts.user}/${parts.repo}/get/${hash}.tar.gz`;
  }

  static getGitHTTPBaseUrl(parts: ExplodedFragment): string {
    return `https://${this.hostname}/${parts.user}/${parts.repo}`;
  }

  static getGitHTTPUrl(parts: ExplodedFragment): string {
    return `${BitbucketResolver.getGitHTTPBaseUrl(parts)}.git`;
  }

  static getGitSSHUrl(parts: ExplodedFragment): string {
    return (
      `git+ssh://git@${this.hostname}/${parts.user}/${parts.repo}.git` +
      `${parts.hash ? '#' + decodeURIComponent(parts.hash) : ''}`
    );
  }

  static getHTTPFileUrl(parts: ExplodedFragment, filename: string, commit: string): string {
    return `https://${this.hostname}/${parts.user}/${parts.repo}/raw/${commit}/${filename}`;
  }

  async hasHTTPCapability(url: string): Promise<boolean> {
    try {
      const result = await this.config.requestManager.request({
        url,
        method: 'HEAD',
        queue: this.resolver.fetchingQueue,
        followRedirect: false,
        rejectStatusCode: 302,
      });
      return result !== false;
    } catch (e) {
      return false;
    }
  }
}
