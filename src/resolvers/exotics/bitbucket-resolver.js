/* @flow */

import type {ExplodedFragment} from './hosted-git-resolver.js';
import HostedGitResolver from './hosted-git-resolver.js';

export default class BitbucketResolver extends HostedGitResolver {
  static hostname = 'bitbucket.org';
  static protocol = 'bitbucket';

  static getTarballUrl(parts: ExplodedFragment, hash: string): string {
    return `https://bitbucket.org/${parts.user}/${parts.repo}/get/${hash}.tar.gz`;
  }

  static getGitHTTPUrl(parts: ExplodedFragment): string {
    return `https://bitbucket.org/${parts.user}/${parts.repo}.git`;
  }

  static getGitSSHUrl(parts: ExplodedFragment): string {
    return `git@bitbucket.org:${parts.user}/${parts.repo}.git`;
  }

  static getHTTPFileUrl(parts: ExplodedFragment, filename: string, commit: string): string {
    return `https://bitbucket.org/${parts.user}/${parts.repo}/raw/${commit}/${filename}`;
  }
}
