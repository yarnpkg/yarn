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
  async getLocalAvailabilityStatus(): Promise<boolean> {
    // Some mirrors might still have files named "./reponame" instead of "./reponame-commit"
    const tarballLegacyMirrorPath = this.getTarballMirrorPath({
      withCommit: false,
    });
    const tarballModernMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballLegacyMirrorPath != null && (await fsUtil.exists(tarballLegacyMirrorPath))) {
      return true;
    }

    if (tarballModernMirrorPath != null && (await fsUtil.exists(tarballModernMirrorPath))) {
      return true;
    }

    if (await fsUtil.exists(tarballCachePath)) {
      return true;
    }

    return false;
  }

  getTarballMirrorPath({withCommit = true}: {withCommit: boolean} = {}): ?string {
    const {pathname} = url.parse(this.reference);

    if (pathname == null) {
      return null;
    }

    const hash = this.hash;

    const packageFilename = withCommit && hash ? `${path.basename(pathname)}-${hash}` : `${path.basename(pathname)}`;

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  getTarballCachePath(): string {
    return path.join(this.dest, constants.TARBALL_FILENAME);
  }

  async fetchFromLocal(override: ?string): Promise<FetchedOverride> {
    const tarballLegacyMirrorPath = this.getTarballMirrorPath({
      withCommit: false,
    });
    const tarballModernMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    const tarballMirrorPath = tarballModernMirrorPath &&
      !await fsUtil.exists(tarballModernMirrorPath) &&
      tarballLegacyMirrorPath &&
      (await fsUtil.exists(tarballLegacyMirrorPath))
      ? tarballLegacyMirrorPath
      : tarballModernMirrorPath;

    const tarballPath = override || tarballMirrorPath || tarballCachePath;

    if (!tarballPath || !await fsUtil.exists(tarballPath)) {
      throw new MessageError(this.reporter.lang('tarballNotInNetworkOrCache', this.reference, tarballPath));
    }

    return new Promise((resolve, reject) => {
      const untarStream = tarFs.extract(this.dest, {
        dmode: 0o555, // all dirs should be readable
        fmode: 0o444, // all files should be readable
        chown: false, // don't chown. just leave as it is
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
              hash: actualHash,
            });
          } else {
            reject(new SecurityError(this.reporter.lang('fetchBadHash', expectHash, actualHash)));
          }
        })
        .on('error', function(err) {
          reject(new MessageError(this.reporter.lang('fetchErrorCorrupt', err.message, tarballPath)));
        });
    });
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const hash = this.hash;
    invariant(hash, 'Commit hash required');

    const gitUrl = Git.npmUrlToGitUrl(this.reference);
    const git = new Git(this.config, gitUrl, hash);
    await git.init();
    await git.clone(this.dest);

    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballMirrorPath) {
      await git.archive(tarballMirrorPath);
    }

    if (tarballCachePath) {
      await git.archive(tarballCachePath);
    }

    return {
      hash,
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
