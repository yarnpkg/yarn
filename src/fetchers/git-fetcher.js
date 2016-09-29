/* @flow */

import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import Git from '../util/git.js';

const url = require('url');

const invariant = require('invariant');

export default class GitFetcher extends BaseFetcher {
  async _fetch(): Promise<FetchedOverride> {
    const {protocol, pathname} = url.parse(this.reference);
    return await this.fetchFromExternal();
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const hash = this.hash;
    invariant(hash, 'Commit hash required');

    const git = new Git(this.config, this.reference, hash);
    await git.initRemote();
    await git.clone(this.dest);

    const mirrorPath = this.getMirrorPath();

    if (mirrorPath) {
      const hash = await git.achieve(this.getMirrorPath());
      return {
        hash,
        resolved: `${this.getRelativeMirrorPath(mirrorPath)}#${hash}`,
      };
    }

    return {
      hash,
      resolved: null,
    };
  }


}
