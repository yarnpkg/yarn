/* @flow */

import HostedGitResolver from "./_hosted-git";

export default class GitLabResolver extends HostedGitResolver {
  static protocol = "gitlab";

  getTarballUrl(commit: string): string {
    return `https://gitlab.com/${this.user}/${this.repo}/repository/archive.tar.gz?ref=${commit}`;
  }

  getGitUrl(): string {
    return `https://gitlab.com/${this.user}/${this.repo}.git`;
  }

  getGitArchiveUrl(): string {
    return `git@gitlab.com:${this.user}/${this.repo}.git`;
  }
}
