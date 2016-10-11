/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import Git from '../util/git.js';
import * as fsUtil from '../util/fs.js';
import * as crypto from '../util/crypto.js';

const tar = require('tar');
const url = require('url');
const path = require('path');
const fs = require('fs');

const invariant = require('invariant');

export default class GitFetcher extends BaseFetcher {
  _fetch(): Promise<FetchedOverride> {
    const {protocol, pathname} = url.parse(this.reference);
    if (protocol === null && typeof pathname === 'string') {
      return this.fetchFromLocal(pathname);
    } else {
      return this.fetchFromExternal();
    }
  }

  async fetchFromLocal(pathname: string): Promise<FetchedOverride> {
    const {reference: ref, config} = this;
    const offlineMirrorPath = config.getOfflineMirrorPath() || '';
    const localTarball = path.resolve(offlineMirrorPath, ref);
    if (!(await fsUtil.exists(localTarball))) {
      throw new MessageError(`${ref}: Tarball is not in network and can not be located in cache (${localTarball})`);
    }

    return new Promise((resolve, reject) => {
      const untarStream = tar.Extract({path: this.dest});

      const hashStream = new crypto.HashStream();

      const cachedStream = fs.createReadStream(localTarball);
      cachedStream
        .pipe(hashStream)
        .pipe(untarStream)
        .on('end', () => {
          const expectHash = this.hash;
          const actualHash = hashStream.getHash();
          if (!expectHash || expectHash === actualHash) {
            resolve({
              hash: actualHash,
              resolved: `${pathname}#${actualHash}`,
            });
          } else {
            reject(new SecurityError(
              `Bad hash. Expected ${expectHash} but got ${actualHash} `,
            ));
          }
        })
        .on('error', function(err) {
          let msg = `${err.message}. `;
          msg += `Mirror tarball appears to be corrupt. You can resolve this by running:\n\n` +
            `  $ rm -rf ${localTarball}\n` +
            '  $ yarn install';
          reject(new MessageError(msg));
        });
    });
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const hash = this.hash;
    invariant(hash, 'Commit hash required');

    const git = new Git(this.config, this.reference, hash);
    await git.initRemote();
    await git.clone(this.dest);

    let tarballInMirrorPath = this.config.getOfflineMirrorPath(this.reference);
    const mirrorRootPath = this.config.getOfflineMirrorPath();
    if (tarballInMirrorPath && this.hash && mirrorRootPath) {
      tarballInMirrorPath = `${tarballInMirrorPath}-${this.hash}`;
      const hash = await git.archive(tarballInMirrorPath);
      const relativeMirrorPath = path.relative(mirrorRootPath, tarballInMirrorPath);
      return {
        hash,
        resolved: relativeMirrorPath ? `${relativeMirrorPath}#${hash}` : null,
      };
    }

    return {
      hash,
      resolved: null,
    };
  }


}
