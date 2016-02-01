/* @flow */

import type { PackageInfo } from "../../types";
import type PackageRequest from "../../package-request";
import { MessageError } from "../../errors";
import TarballResolver from "./tarball";
import GitResolver from "./git";
import ExoticResolver from "./_base";
import Git from "../../util/git";

function explodeHostedGitFragment(fragment: string): {
  user: string;
  repo: string;
  hash: string;
} {
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

    let { user, repo, hash } = explodeHostedGitFragment(fragment);
    this.user = user;
    this.repo = repo;
    this.hash = hash;
  }

  url: string;
  user: string;
  repo: string;
  hash: string;

  getTarballUrl(commit: string): string {
    commit;
    throw new Error("Not implemented");
  }

  getGitUrl(): string {
    throw new Error("Not implemented");
  }

  getGitArchiveUrl(): string {
    return "";
  }

  async resolve(): Promise<PackageInfo> {
    let archiveUrl = this.getGitArchiveUrl();
    if (archiveUrl && await Git.hasArchiveCapability(archiveUrl)) {
      let archiveClient = new Git(this.config, archiveUrl, this.hash);
      let commit = await archiveClient.init();
      // the capability will be cached so we can go straight to the git resolver
      return await this.fork(GitResolver, true, `${archiveUrl}#${commit}`);
    }

    let gitUrl = this.getGitUrl();
    let client = new Git(this.config, gitUrl, this.hash);
    let commit = await client.init();

    let tarballUrl = this.getTarballUrl(commit);
    try {
      return await this.fork(TarballResolver, false, tarballUrl);
    } catch (err) {
      this.reporter.warn(
        `Download of tarball ${tarballUrl} failed with error message ${JSON.stringify(err.message)}. ` +
        `Trying git...`
      );
      // TODO: this will cause an infinite loop for github due to the shorthand fast path
      return await this.fork(GitResolver, true, `${gitUrl}#${commit}`);
    }
  }
}
