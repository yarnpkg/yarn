/* @flow */

import type { PackageInfo } from "../../types";
import type PackageRequest from "../../package-request";
import { MessageError } from "../../errors";
import * as util from "../../util/misc";
import * as versionUtil from "../../util/version";
import { registries } from "../../registries";
import GitHubResolver from "./github";
import ExoticResolver from "./_base";
import Git from "../../util/git";

let urlParse = require("url").parse;
let _        = require("lodash");

// we purposefully omit https and http as those are only valid if they end in the .git extension
const GIT_PROTOCOLS = ["git", "git+ssh", "git+https", "ssh"];

export default class GitResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    let { url, hash } = versionUtil.explodeHashedUrl(fragment);
    this.url  = url;
    this.hash = hash;
  }

  url: string;
  hash: string;

  static isVersion(pattern: string): boolean {
    let parts = urlParse(pattern);

    let pathname = parts.pathname;
    if (_.endsWith(pathname, ".git")) {
      // ends in .git
      return true;
    }

    if (parts.protocol) {
      if (GIT_PROTOCOLS.indexOf(parts.protocol) >= 0) {
        return true;
      }
    }

    return false;
  }

  async resolve(forked?: true): Promise<PackageInfo> {
    let { url } = this;

    // TODO: make this generic
    let parts = urlParse(url);
    if (!forked && !parts.auth && parts.host === "github.com" && parts.pathname) {
      // if this is a github git url then pipe us through the github pipeline as it's much
      // more efficient
      let pathname = parts.pathname.slice(1); // remove prefixed slash
      pathname = util.removeSuffix(pathname, ".git"); // remove .git suffix if present
      return this.fork(GitHubResolver, false, `${pathname}${decodeURIComponent(parts.hash || "")}`);
    }

    // get from lockfile
    let shrunk = this.request.getLocked("git");
    if (shrunk) return shrunk;

    let client = new Git(this.config, url, this.hash);
    let commit = await client.init();

    async function tryRegistry(registry) {
      let filename = registries[registry].filename;
      let file = await client.getFile(filename);
      if (!file) return;

      let json = JSON.parse(file);
      json.uid = commit;
      json.remote = {
        resolved: `${url}#${commit}`,
        type: "git",
        reference: url,
        hash: commit,
        registry
      };

      return json;
    }

    let file = await tryRegistry(this.registry);
    if (file) return file;

    for (let registry in registries) {
      if (registry === this.registry) continue;

      let file = await tryRegistry(registry);
      if (file) return file;
    }

    throw new MessageError(`Could not find package metadata file in ${url}`);
  }
}
