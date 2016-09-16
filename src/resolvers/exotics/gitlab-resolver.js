/* @flow */

import type {ExplodedFragment} from './hosted-git-resolver.js';
import HostedGitResolver from './hosted-git-resolver.js';

export default class GitLabResolver extends HostedGitResolver {
  static hostname = 'gitlab.com';
  static protocol = 'gitlab';

  static getTarballUrl(parts: ExplodedFragment, hash: string): string {
    return `https://gitlab.com/${parts.user}/${parts.repo}/repository/archive.tar.gz?ref=${hash}`;
  }

  static getGitHTTPUrl(parts: ExplodedFragment): string {
    return `https://gitlab.com/${parts.user}/${parts.repo}.git`;
  }

  static getGitSSHUrl(parts: ExplodedFragment): string {
    return `git@gitlab.com:${parts.user}/${parts.repo}.git`;
  }

  static getHTTPFileUrl(parts: ExplodedFragment, filename: string, commit: string): string {
    return `https://gitlab.com/${parts.user}/${parts.repo}/raw/${commit}/${filename}`;
  }
}
