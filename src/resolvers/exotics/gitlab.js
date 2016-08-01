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

  static getHTTPFileUrl({ user, repo }: ExplodedFragment, filename: string, commit: string): string {
    return `https://gitlab.com/${user}/${repo}/raw/${commit}/${filename}`;
  }
}
