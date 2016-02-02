/* @flow */

import type { ExplodedFragment } from "./_hosted-git";
import HostedGitResolver from "./_hosted-git";

export default class GitLabResolver extends HostedGitResolver {
  static protocol = "gitlab";

  getTarballUrl({ user, repo, hash }: ExplodedFragment): string {
    return `https://gitlab.com/${user}/${repo}/repository/archive.tar.gz?ref=${hash}`;
  }

  getGitUrl({ user, repo }: ExplodedFragment): string {
    return `https://gitlab.com/${user}/${repo}.git`;
  }

  getGitArchiveUrl({ user, repo }: ExplodedFragment): string {
    return `git@gitlab.com:${user}/${repo}.git`;
  }
}
