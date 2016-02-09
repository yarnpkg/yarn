/* @flow */

import type { ExplodedFragment } from "./_hosted-git.js";
import HostedGitResolver from "./_hosted-git.js";

export default class BitbucketResolver extends HostedGitResolver {
  static hostname = "bitbucket.com";
  static protocol = "bitbucket";

  static getTarballUrl({ user, repo }: ExplodedFragment, hash: string): string {
    return `https://bitbucket.org/${user}/${repo}/get/${hash}.tar.gz`;
  }

  static getGitHTTPUrl({ user, repo }: ExplodedFragment): string {
    return `https://bitbucket.org/${user}/${repo}.git`;
  }

  static getGitSSHUrl({ user, repo }: ExplodedFragment): string {
    return `git@bitbucket.org:${user}/${repo}.git`;
  }
}
