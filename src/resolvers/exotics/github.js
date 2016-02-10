/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type { ExplodedFragment } from "./_hosted-git.js";
import HostedGitResolver from "./_hosted-git.js";

let _ = require("lodash");

export default class GitHubResolver extends HostedGitResolver {
  static protocol = "github";
  static hostname = "github.com";

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

  static getTarballUrl({ user, repo }: ExplodedFragment, hash: string): string {
    return `https://codeload.github.com/${user}/${repo}/tar.gz/${hash}`;
  }

  static getGitSSHUrl({ user, repo }: ExplodedFragment): string {
    return `git@github.com:${user}/${repo}.git`;
  }

  static getGitHTTPUrl({ user, repo }: ExplodedFragment): string {
    return `https://github.com/${user}/${repo}.git`;
  }

  static getHTTPFileUrl({ user, repo }: ExplodedFragment, filename: string, commit: string) {
    return `https://raw.githubusercontent.com/${user}/${repo}/${commit}/${filename}`;
  }
}
