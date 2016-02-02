/* @flow */

import type { ExplodedFragment } from "./_hosted-git";
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

  static getTarballUrl({ user, repo, hash }: ExplodedFragment): string {
    return `https://codeload.github.com/${user}/${repo}/tar.gz/${hash}`;
  }

  static getGitArchiveUrl({ user, repo }: ExplodedFragment): string {
    return `git@github.com:${user}/${repo}.git`;
  }

  static getGitUrl({ user, repo }: ExplodedFragment): string {
    return `https://github.com/${user}/${repo}.git`;
  }
}
