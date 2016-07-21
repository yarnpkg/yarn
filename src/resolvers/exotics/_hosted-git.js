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

import type { Manifest } from "../../types.js";
import type PackageRequest from "../../package-request.js";
import { MessageError } from "../../errors.js";
import { registries } from "../../registries/index.js";
import GitResolver from "./git.js";
import ExoticResolver from "./_base.js";
import Git from "../../util/git.js";

export type ExplodedFragment = {
  user: string;
  repo: string;
  hash: string;
};

export function explodeHostedGitFragment(fragment: string): ExplodedFragment {
  // TODO: make sure this only has a length of 2
  let parts = fragment.split(":");
  fragment = parts.pop();

  let userParts = fragment.split("/");

  if (userParts.length === 2) {
    let user = userParts.shift();
    let repoParts = userParts.shift().split("#");

    if (repoParts.length <= 2) {
      return {
        user: user,
        repo: repoParts[0],
        hash: repoParts[1] || ""
      };
    }
  }

  throw new MessageError(`Invalid hosted git fragment ${fragment}`);
}

export default class HostedGitResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    let exploded = this.exploded = explodeHostedGitFragment(fragment);
    let { user, repo, hash } = exploded;
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
    throw new Error("Not implemented");
  }

  static getGitHTTPUrl(exploded: ExplodedFragment): string {
    exploded;
    throw new Error("Not implemented");
  }

  static getGitSSHUrl(exploded: ExplodedFragment): string {
    exploded;
    throw new Error("Not implemented");
  }

  static getHTTPFileUrl(exploded: ExplodedFragment, filename: string, commit: string) {
    exploded;
    filename;
    commit;
    throw new Error("Not implemented");
  }

  async getRefOverHTTP(url: string): Promise<string> {
    let client = new Git(this.config, url, this.hash);

    let out = await this.config.requestManager.request({
      url: `${url}/info/refs?service=git-upload-pack`,
      queue: this.resolver.fetchingQueue
    });

    if (out) {
      // clean up output
      let lines = out.trim().split("\n");

      // remove first two lines which contains compatibility info etc
      lines = lines.slice(2);

      // remove last line which contains the terminator "0000"
      lines.pop();

      // remove line lengths from start of each line
      lines = lines.map((line) => line.slice(4));

      out = lines.join("\n");
    } else {
      throw new Error("TODO");
    }

    let refs = Git.parseRefs(out);
    return await client.setRef(refs);
  }

  async resolveOverHTTP(url: string): Promise<Manifest> {
    // TODO: hashes and lockfile
    let self = this; // TODO: babel bug...
    let commit = await this.getRefOverHTTP(url);

    let tryRegistry = async (registry) => {
      let filenames = registries[registry].filenames;
      for (let filename of filenames) {
        let file = await self.config.requestManager.request({
          url: self.constructor.getHTTPFileUrl(self.exploded, filename, commit),
          queue: this.resolver.fetchingQueue
        });
        if (!file) continue;

        let json = JSON.parse(file);
        json.uid = commit;
        json.remote = {
          //resolved // TODO
          type: "tarball",
          reference: self.constructor.getTarballUrl(self.exploded, commit),
          registry
        };

        return json;
      }
    };

    let file = await tryRegistry(this.registry);
    if (file) return file;

    for (let registry in registries) {
      if (registry === this.registry) continue;

      let file = await tryRegistry(registry);
      if (file) return file;
    }

    throw new MessageError(`Could not find package metadata file in ${url}`);
  }

  async hasHTTPCapability(url: string): Promise<boolean> {
    return (await this.config.requestManager.request({
      url,
      method: "HEAD",
      queue: this.resolver.fetchingQueue
    })) !== false;
  }

  async resolve(): Promise<Manifest> {
    let httpUrl = this.constructor.getGitHTTPUrl(this.exploded);
    let sshUrl  = this.constructor.getGitSSHUrl(this.exploded);

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
      let archiveClient = new Git(this.config, sshUrl, this.hash);
      let commit = await archiveClient.initRemote();
      return await this.fork(GitResolver, true, `${sshUrl}#${commit}`);
    }

    // fallback to the plain git resolver
    return await this.fork(GitResolver, true, sshUrl);
  }
}
