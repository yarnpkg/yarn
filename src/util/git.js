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

import type Config from "../config.js";
import { MessageError, SecurityError } from "../errors.js";
import { removeSuffix } from "./misc.js";
import * as crypto from "./crypto.js";
import * as child from "./child.js";
import * as fs from "./fs.js";
import map from "./map.js";

let invariant = require("invariant");
let semver    = require("semver");
let url       = require("url");
let tar       = require("tar");

type GitRefs = {
  [name: string]: string
};

let supportsArchiveCache = map({
  "github.com": false // not support, doubt they will ever support it
});

export default class Git {
  constructor(config: Config, url: string, hash: string) {
    Git.assertUrl(url, hash);

    this.supportsArchive = false;
    this.fetched         = false;
    this.config          = config;
    this.hash            = hash;
    this.ref             = hash;
    this.url             = url;
    this.cwd             = this.config.getTemp(crypto.hash(this.url));
  }

  supportsArchive: boolean;
  fetched: boolean;
  config: Config;
  hash: string;
  ref: string;
  cwd: string;
  url: string;

  /**
   * Check if the host specified in the input `gitUrl` has archive capability.
   */

  static async hasArchiveCapability(gitUrl: string): Promise<boolean> {
    // USER@HOSTNAME:PATHNAME
    let match = gitUrl.match(/^(.*?)@(.*?):(.*?)$/);
    if (!match) return false;

    let [,, hostname] = match;
    let cached = supportsArchiveCache[hostname];
    if (cached != null) return cached;

    try {
      await child.spawn("git", ["archive", `--remote=${gitUrl}`, "HEAD", Date.now() + ""]);
      throw new Error;
    } catch (err) {
      let supports = err.message.indexOf("did not match any files") >= 0;
      return supportsArchiveCache[hostname] = supports;
    }
  }

  /**
   * Check if the input `target` is a 40 character hex commit hash.
   */

  static isCommitHash(target: string): boolean {
    return !!target && /^[a-f0-9]{40}$/.test(target);
  }

  /**
   * Assert that a URL is safe to fetch from. Forbid insecure URLs like plain HTTP with no
   * hash.
   */

  static assertUrl(ref: string, hash: string) {
    if (Git.isCommitHash(hash)) {
      // this is cryptographically secure
      return;
    }

    let parts = url.parse(ref);

    if (parts.protocol === "git") {
      throw new SecurityError(
        `Refusing to download the git repo ${ref} over plain git without a commit hash`
      );
    }

    if (parts.protocol === "http:") {
      throw new SecurityError(
        `Refusing to download the git repo ${ref} over HTTP without a commit hash`
      );
    }
  }

  /**
   * Clone a repo to the input `dest`. Use `git archive` if it's available, otherwise fall
   * back to `git clone`.
   */

  async clone(dest: string): Promise<void> {
    if (this.supportsArchive) {
      return this._cloneViaRemoteArchive(dest);
    } else {
      return this._cloneViaLocalFetched(dest);
    }
  }

  async _cloneViaRemoteArchive(dest: string): Promise<void> {
    await child.spawn("git", ["archive", `--remote=${this.url}`, this.ref], {
      process(proc, update, reject, done) {
        let extractor = tar.Extract({ path: dest });
        extractor.on("error", reject);
        extractor.on("end", done);

        proc.stdout.pipe(extractor);
        proc.on("error", reject);
      }
    });
  }

  async _cloneViaLocalFetched(dest: string): Promise<void> {
    await child.spawn("git", ["archive", this.ref], {
      cwd: this.cwd,
      process(proc, resolve, reject) {
        let extractor = tar.Extract({ path: dest });
        extractor.on("error", reject);

        proc.stdout.pipe(extractor);
      }
    });
  }

  /**
   * Clone this repo.
   */

  fetch(): Promise<void> {
    let { url, cwd } = this;

    return fs.lockQueue.push(url, async () => {
      if (!(await fs.exists(cwd))) {
        await fs.mkdirp(cwd);
        await child.spawn("git", ["init", "--bare"], { cwd });
      }

      await child.spawn("git", ["fetch", url, "--tags"], { cwd });

      this.fetched = true;
    });
  }

  /**
   * Given a list of tags/branches from git, check if they match an input range.
   */

  async findResolution(range: ?string, tags: Array<string>): Promise<string> {
    // If there are no tags and target is *, fallback to the latest commit on master
    // or if we have no target.
    if (!range || (!tags.length && range === "*")) {
      return "master";
    }

    return await this.config.resolveConstraints(tags.filter((tag) => !!semver.valid(tag)), range) || range;
  }

  /**
   * Fetch the file by cloning the repo and reading it.
   */

  async getFile(filename: string): Promise<string | false> {
    if (this.supportsArchive) {
      return this._getFileFromArchive(filename);
    } else {
      return this._getFileFromClone(filename);
    }
  }

  async _getFileFromArchive(filename: string): Promise<string | false> {
    try {
      return await child.spawn("git", ["archive", `--remote=${this.url}`, this.ref, filename], {
        process(proc, update, reject, done) {
          let parser = tar.Parse();

          parser.on("error", reject);
          parser.on("end", done);

          parser.on("data", function (entry) {
            update(entry.toString());
          });

          proc.stdout.pipe(parser);
        }
      });
    } catch (err) {
      if (err.message.indexOf("did not match any files") >= 0) {
        return false;
      } else {
        throw err;
      }
    }
  }

  async _getFileFromClone(filename: string): Promise<string | false> {
    invariant(this.fetched, "Repo not fetched");

    try {
      return await child.spawn("git", ["show", `${this.hash}:${filename}`], { cwd: this.cwd });
    } catch (err) {
      // file doesn't exist
      return false;
    }
  }

  /**
   * Try and find a ref from this repo that matches an input `target`.
   */

  async initRemote(): Promise<string> {
    // check capabilities
    if (await Git.hasArchiveCapability(this.url)) {
      this.supportsArchive = true;
    } else {
      await this.fetch();
    }

    return await this.setRefRemote();
  }

  async setRefRemote(): Promise<string> {
    let stdout = await child.spawn("git", ["ls-remote", "--tags", "--heads", this.url]);
    let refs   = Git.parseRefs(stdout);
    return await this.setRef(refs);
  }

  /**
   * TODO description
   */

  async setRef(refs: GitRefs): Promise<string> {
    // get commit ref
    let { hash } = this;

    let names = Object.keys(refs);

    if (Git.isCommitHash(hash)) {
      for (let name in refs) {
        if (refs[name] === hash) {
          this.ref = name;
          return hash;
        }
      }

      // `git archive` only accepts a treeish and we have no ref to this commit
      this.supportsArchive = false;
      return this.ref = this.hash = hash;
    }

    let ref = await this.findResolution(hash, names);
    let commit = refs[ref];
    if (commit) {
      this.ref = ref;
      return this.hash = commit;
    } else {
      throw new MessageError(
        `Could not find match for ${JSON.stringify(ref)} in ${names.join(",")} for ${this.url}`
      );
    }
  }

  /**
   * TODO description
   */

  static parseRefs(stdout: string): GitRefs {
    // store references
    let refs = {};

    // line delimetered
    let refLines = stdout.split("\n");

    for (let line of refLines) {
      // line example: 64b2c0cee9e829f73c5ad32b8cc8cb6f3bec65bb refs/tags/v4.2.2
      let [sha, id] = line.split(/\s+/g);
      let [,, name] = id.split("/");

      // TODO: find out why this is necessary. idk it makes it work...
      name = removeSuffix(name, "^{}");

      refs[name] = sha;
    }

    return refs;
  }
}
