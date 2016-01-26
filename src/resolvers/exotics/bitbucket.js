/* @flow */

import HostedGitResolver from "./_hosted-git";

export default class BitbucketResolver extends HostedGitResolver {
  static protocol = "bitbucket";

  getTarballUrl(commit: string): string {
    return `https://bitbucket.org/${this.user}/${this.repo}/get/${commit}.tar.gz`;
  }

  getGitUrl(): string {
    return `https://bitbucket.org/${this.user}/${this.repo}.git`;
  }

  getGitArchiveUrl(): string {
    return `git@bitbucket.org:${this.user}/${this.repo}.git`;
  }
}
