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

import type { PackageInfo } from "../../types.js";
import type PackageRequest from "../../package-request.js";
import { hostedGit as hostedGitResolvers } from "../index.js";
import { MessageError } from "../../errors.js";
import * as util from "../../util/misc.js";
import * as versionUtil from "../../util/version.js";
import { registries } from "../../registries/index.js";
import ExoticResolver from "./_base.js";
import Git from "../../util/git.js";

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

    // shortcut for hosted git. we will fallback to a GitResolver if the hosted git
    // optimisations fail which the `forked` flag indicates so we don't get into an
    // infinite loop
    let parts = urlParse(url);
    if (!forked && !parts.auth && parts.pathname) {
      // check if this git url uses any of the hostnames defined in our hosted git resolvers
      for (let name in hostedGitResolvers) {
        let Resolver = hostedGitResolvers[name];
        if (Resolver.hostname !== parts.hostname) continue;

        // we have a match! clean up the pathname of url artifcats
        let pathname = parts.pathname;
        pathname = util.removePrefix(pathname, "/"); // remove prefixed slash
        pathname = util.removeSuffix(pathname, ".git"); // remove .git suffix if present

        // create the request pattern. if we have a `hash` then it'll be url encoded and
        // start with a #
        let url = `${pathname}${decodeURIComponent(parts.hash || "")}`;
        return this.fork(Resolver, false, url);
      }
    }

    // get from lockfile
    let shrunk = this.request.getLocked("git");
    if (shrunk) return shrunk;

    let client = new Git(this.config, url, this.hash);
    let commit = await client.initRemote();

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
