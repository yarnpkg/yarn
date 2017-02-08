/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import {registries} from '../registries/index.js';
import Git from '../util/git.js';
import * as fsUtil from '../util/fs.js';
import * as crypto from '../util/crypto.js';

const tar = require('tar');
const url = require('url');
const path = require('path');
const fs = require('fs');

const invariant = require('invariant');

export default class GitFetcher extends BaseFetcher {
  async _fetch(): Promise<FetchedOverride> {
    const {protocol, pathname} = url.parse(this.reference);
    let result;
    if (protocol === null && typeof pathname === 'string') {
      result = await this.fetchFromLocal(pathname);
    } else {
      result = await this.fetchFromExternal();
    }
    // TODO hack
    const manifest = path.join(this.dest, registries[this.registry].filename);
    if (!await fsUtil.exists(manifest)) {
      const pkg = {
        name: 'test',
        version: '0.0.0'
      };
      await fsUtil.writeFile(manifest, JSON.stringify(pkg, null, 4));
    }
    return result;
  }

  async fetchFromLocal(pathname: string): Promise<FetchedOverride> {
    const {reference: ref, config} = this;
    const offlineMirrorPath = config.getOfflineMirrorPath() || '';
    const localTarball = path.resolve(offlineMirrorPath, ref);
    const {reporter} = config;
    if (!(await fsUtil.exists(localTarball))) {
      throw new MessageError(reporter.lang('tarballNotInNetworkOrCache', ref, localTarball));
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
              reporter.lang('fetchBadHash', expectHash, actualHash),
            ));
          }
        })
        .on('error', function(err) {
          reject(new MessageError(reporter.lang('fetchErrorCorrupt', err.message, localTarball)));
        });
    });
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const commit = this.hash;
    invariant(commit, 'Commit hash required');

    const git = new Git(this.config, this.reference, commit);
    await git.init();
    await git.clone(this.dest);

    // Get the tarball filename from the url
    const {pathname} = url.parse(this.reference);
    let tarballFilename;
    if (pathname == null) {
      tarballFilename = this.reference;
    } else {
      tarballFilename = path.basename(pathname);
    }

    let tarballInMirrorPath = this.config.getOfflineMirrorPath(tarballFilename);

    const mirrorRootPath = this.config.getOfflineMirrorPath();
    if (tarballInMirrorPath && this.hash && mirrorRootPath) {
      tarballInMirrorPath = `${tarballInMirrorPath}-${commit}`;
      const hash = await git.archive(tarballInMirrorPath);
      const relativeMirrorPath = path.relative(mirrorRootPath, tarballInMirrorPath);
      return {
        hash: commit,
        resolved: relativeMirrorPath ? `${relativeMirrorPath}#${hash}` : null,
      };
    }

    return {
      hash: commit,
      resolved: null,
    };
  }
}
