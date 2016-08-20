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

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../PackageRequest.js';
import {MessageError} from '../../errors.js';
import {registries} from '../../registries/index.js';
import GitResolver from './GitResolver.js';
import ExoticResolver from './ExoticResolver.js';
import Git from '../../util/git.js';

export type ExplodedFragment = {
  user: string,
  repo: string,
  hash: string,
};

export function explodeHostedGitFragment(fragment: string): ExplodedFragment {
  // TODO: make sure this only has a length of 2
  const parts = fragment.split(':');
  fragment = parts.pop();

  const userParts = fragment.split('/');

  if (userParts.length === 2) {
    const user = userParts.shift();
    const repoParts = userParts.shift().split('#');

    if (repoParts.length <= 2) {
      return {
        user,
        repo: repoParts[0],
        hash: repoParts[1] || '',
      };
    }
  }

  throw new MessageError(`Invalid hosted git fragment ${fragment}`);
}

export default class HostedGitResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const exploded = this.exploded = explodeHostedGitFragment(fragment);
    let {user, repo, hash} = exploded;
    this.user = user;
    this.repo = repo;
    this.hash = hash;
  }

  exploded: ExplodedFragment;
  url: string;
  user: string;
  repo: string;
  hash: string;

  static getTarballUrl(exploded: ExplodedFragment, commit: string): string {
    exploded;
    commit;
    throw new Error('Not implemented');
  }

  static getGitHTTPUrl(exploded: ExplodedFragment): string {
    exploded;
    throw new Error('Not implemented');
  }

  static getGitSSHUrl(exploded: ExplodedFragment): string {
    exploded;
    throw new Error('Not implemented');
  }

  static getHTTPFileUrl(exploded: ExplodedFragment, filename: string, commit: string) {
    exploded;
    filename;
    commit;
    throw new Error('Not implemented');
  }

  async getRefOverHTTP(url: string): Promise<string> {
    const client = new Git(this.config, url, this.hash);

    let out = await this.config.requestManager.request({
      url: `${url}/info/refs?service=git-upload-pack`,
      queue: this.resolver.fetchingQueue,
    });

    if (out) {
      // clean up output
      let lines = out.trim().split('\n');

      // remove first two lines which contains compatibility info etc
      lines = lines.slice(2);

      // remove last line which contains the terminator "0000"
      lines.pop();

      // remove line lengths from start of each line
      lines = lines.map((line): string => line.slice(4));

      out = lines.join('\n');
    } else {
      throw new Error('TODO');
    }

    const refs = Git.parseRefs(out);
    return await client.setRef(refs);
  }

  async resolveOverHTTP(url: string): Promise<Manifest> {
    // TODO: hashes and lockfile
    const commit = await this.getRefOverHTTP(url);

    const tryRegistry = async (registry): Promise<?Manifest> => {
      const filename = registries[registry].filename;

      const file = await this.config.requestManager.request({
        url: this.constructor.getHTTPFileUrl(this.exploded, filename, commit),
        queue: this.resolver.fetchingQueue,
      });
      if (!file) {
        return null;
      }

      const json = JSON.parse(file);
      json.uid = commit;
      json.remote = {
        //resolved // TODO
        type: 'tarball',
        reference: this.constructor.getTarballUrl(this.exploded, commit),
        registry,
      };
      return json;
    };

    const file = await tryRegistry(this.registry);
    if (file) {
      return file;
    }

    for (const registry in registries) {
      if (registry === this.registry) {
        continue;
      }

      const file = await tryRegistry(registry);
      if (file) {
        return file;
      }
    }

    throw new MessageError(`Could not find package metadata file in ${url}`);
  }

  async hasHTTPCapability(url: string): Promise<boolean> {
    return (await this.config.requestManager.request({
      url,
      method: 'HEAD',
      queue: this.resolver.fetchingQueue,
    })) !== false;
  }

  async resolve(): Promise<Manifest> {
    const httpUrl = this.constructor.getGitHTTPUrl(this.exploded);
    const sshUrl  = this.constructor.getGitSSHUrl(this.exploded);

    // If we can access the files over HTTP then we should as it's MUCH faster than git
    // archive and tarball unarchiving. The HTTP API is only available for public repos
    // though.
    if (await this.hasHTTPCapability(httpUrl)) {
      return await this.resolveOverHTTP(httpUrl);
    }

    // If the url is accessible over git archive then we should immediately delegate to
    // the git resolver.
    //
    // NOTE: Here we use a different url than when we delegate to the git resolver later on.
    // This is because `git archive` requires access over ssh and github only allows that
    // if you have write permissions
    if (await Git.hasArchiveCapability(sshUrl)) {
      const archiveClient = new Git(this.config, sshUrl, this.hash);
      const commit = await archiveClient.initRemote();
      return await this.fork(GitResolver, true, `${sshUrl}#${commit}`);
    }

    // fallback to the plain git resolver
    return await this.fork(GitResolver, true, sshUrl);
  }
}
