/* @flow */

import HostedGitResolver from "./_hosted-git";

let _ = require("lodash");

export default class GitHubResolver extends HostedGitResolver {
  static isVersion(pattern: string): boolean {
    // github proto
    if (_.startsWith(pattern, "github:")) {
      return true;
    }

    // github shorthand
    if (/^[^:@%/\s.-][^:@%/\s]*[/][^:@\s/%]+(?:#.*)?$/.test(pattern)) {
      return true;
    }

    return false;
  }

  getTarballUrl(commit: string): string {
    return `https://codeload.github.com/${this.user}/${this.repo}/tar.gz/${commit}`;
  }

  getGitArchiveUrl(): string {
    return `git@github.com:${this.user}/${this.repo}.git`;
  }

  getGitUrl(): string {
    return `https://github.com/${this.user}/${this.repo}.git`;
  }
}
