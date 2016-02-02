/* @flow */

import type { ExplodedFragment } from "./_hosted-git";
import HostedGitResolver from "./_hosted-git";

export default class BitbucketResolver extends HostedGitResolver {
  static protocol = "bitbucket";

  static getTarballUrl({ user, repo, hash }: ExplodedFragment): string {
    return `https://bitbucket.org/${user}/${repo}/get/${hash}.tar.gz`;
  }

  static getGitUrl({ user, repo }: ExplodedFragment): string {
    return `https://bitbucket.org/${user}/${repo}.git`;
  }

  static getGitArchiveUrl({ user, repo }: ExplodedFragment): string {
    return `git@bitbucket.org:${user}/${repo}.git`;
  }
}
