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

import type {ExplodedFragment} from './_hosted-git.js';
import HostedGitResolver from './_hosted-git.js';

export default class GitLabResolver extends HostedGitResolver {
  static hostname = 'gitlab.com';
  static protocol = 'gitlab';

  static getTarballUrl(parts: ExplodedFragment, hash: string): string {
    return `https://gitlab.com/${parts.user}/${parts.repo}/repository/archive.tar.gz?ref=${hash}`;
  }

  static getGitHTTPUrl(parts: ExplodedFragment): string {
    return `https://gitlab.com/${parts.user}/${parts.repo}.git`;
  }

  static getGitSSHUrl(parts: ExplodedFragment): string {
    return `git@gitlab.com:${parts.user}/${parts.repo}.git`;
  }

  static getHTTPFileUrl(parts: ExplodedFragment, filename: string, commit: string): string {
    return `https://gitlab.com/${parts.user}/${parts.repo}/raw/${commit}/${filename}`;
  }
}
