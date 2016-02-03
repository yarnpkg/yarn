/* @flow */

import type { ExplodedFragment } from "./_hosted-git";
import HostedGitResolver from "./_hosted-git";

export default class GitLabResolver extends HostedGitResolver {
  static hostname = "gitlab.com";
  static protocol = "gitlab";

  static getTarballUrl({ user, repo }: ExplodedFragment, hash: string): string {
    return `https://gitlab.com/${user}/${repo}/repository/archive.tar.gz?ref=${hash}`;
  }

  static getGitHTTPUrl({ user, repo }: ExplodedFragment): string {
    return `https://gitlab.com/${user}/${repo}.git`;
  }

  static getGitSSHUrl({ user, repo }: ExplodedFragment): string {
    return `git@gitlab.com:${user}/${repo}.git`;
  }
}
