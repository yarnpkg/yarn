/* @flow */

import BaseFetcher from "./_base";
import Git from "../util/git";

let invariant = require("invariant");

export default class GitFetcher extends BaseFetcher {
  async _fetch(dest: string): Promise<string> {
    let hash = this.hash;
    invariant(hash, "Commit hash required");

    let git = new Git(this.config, this.reference, hash);
    await git.initRemote();
    await git.clone(dest);
    return hash;
  }
}
