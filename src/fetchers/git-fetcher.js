/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import Git from '../util/git.js';
import * as fsUtil from '../util/fs.js';
import * as constants from '../constants.js';
import * as crypto from '../util/crypto.js';

const tarFs = require('tar-fs');
const url = require('url');
const path = require('path');
const fs = require('fs');

const invariant = require('invariant');

export default class GitFetcher extends BaseFetcher {
  async getLocalAvailabilityStatus(): Promise<bool> {
    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballMirrorPath != null && await fsUtil.exists(tarballMirrorPath)) {
      return true;
    }

    if (await fsUtil.exists(tarballCachePath)) {
      return true;
    }

    return false;
  }

  getTarballMirrorPath() {
    const {pathname} = url.parse(this.reference);

    if (pathname === null) {
      return null;
    }

    const packageFilename = path.basename(pathname);

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  getTarballCachePath(): string {
    return path.join(this.dest, constants.TARBALL_FILENAME);
  }

  async fetchFromLocal(override: string): Promise<FetchedOverride> {
    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    const tarballPath = override || tarballMirrorPath || tarballCachePath;

    if (!tarballPath || !await fsUtil.exists(tarballPath)) {
      throw new MessageError(reporter.lang('tarballNotInNetworkOrCache', this.reference, tarballPath));
    }

    return new Promise((resolve, reject) => {
      const untarStream = tarFs.extract(this.dest, {
        dmode: 0o555, // all dirs should be readable
        fmode: 0o444, // all files should be readable
      });

      const hashStream = new crypto.HashStream();

      const cachedStream = fs.createReadStream(tarballPath);
      cachedStream
        .pipe(hashStream)
        .pipe(untarStream)
        .on('finish', () => {
          const expectHash = this.hash;
          const actualHash = hashStream.getHash();
          if (!expectHash || expectHash === actualHash) {
            resolve({
              hash: actualHash
            });
          } else {
            reject(new SecurityError(
              reporter.lang('fetchBadHash', expectHash, actualHash),
            ));
          }
        })
        .on('error', function(err) {
          reject(new MessageError(reporter.lang('fetchErrorCorrupt', err.message, tarballPath)));
        });
    });
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const commit = this.hash;
    invariant(commit, 'Commit hash required');

    const git = new Git(this.config, this.reference, commit);
    await git.init();
    await git.clone(this.dest);

    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballMirrorPath)
      await git.archive(tarballMirrorPath);

    if (tarballCachePath)
      await git.archive(tarballCachePath);

    return {
      hash: commit,
    };
  }

  async _fetch(): Promise<FetchedOverride> {
    if (await this.getLocalAvailabilityStatus()) {
      return this.fetchFromLocal();
    } else {
      return this.fetchFromExternal();
    }
  }
}
