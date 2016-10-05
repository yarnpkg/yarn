/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import {UnpackStream} from '../util/stream.js';
import * as constants from '../constants.js';
import * as crypto from '../util/crypto.js';
import BaseFetcher from './base-fetcher.js';
import * as fsUtil from '../util/fs.js';

const invariant = require('invariant');
const path = require('path');
const tar = require('tar');
const url = require('url');
const fs = require('fs');

export default class TarballFetcher extends BaseFetcher {
  async getResolvedFromCached(hash: string): Promise<?string> {
    let mirrorPath = this.getMirrorPath();
    if (mirrorPath == null) {
      // no mirror
      return null;
    }

    if (await fsUtil.exists(mirrorPath)) {
      // already exists in the mirror
      return null;
    }

    let tarballLoc = path.join(this.dest, constants.TARBALL_FILENAME);
    if (!(await fsUtil.exists(tarballLoc))) {
      // no tarball located in the cache
      return null;
    }

    // copy the file over
    await fsUtil.copy(tarballLoc, mirrorPath);

    const relativeMirrorPath = this.getRelativeMirrorPath(mirrorPath);
    invariant(relativeMirrorPath != null, 'Missing offline mirror path');

    return `${relativeMirrorPath}#${hash}`;
  }

  getMirrorPath(): ?string {
    return this.config.getOfflineMirrorPath(this.reference);
  }

  getRelativeMirrorPath(mirrorPath: string): ?string {
    const offlineMirrorPath = this.config.getOfflineMirrorPath();
    if (offlineMirrorPath == null) {
      return null;
    }
    return path.relative(offlineMirrorPath, mirrorPath);
  }

  createExtractor(
    mirrorPath: ?string,
    resolve: (fetched: FetchedOverride) => void,
    reject: (error: any) => void,
  ): {
    validateStream: crypto.HashStream,
    extractorStream: UnpackStream,
  } {
    const validateStream = new crypto.HashStream();
    const extractorStream = new UnpackStream();
    const untarStream = tar.Extract({path: this.dest, strip: 1});

    extractorStream
      .pipe(untarStream)
      .on('error', reject)
      .on('end', () => {
        const expectHash = this.hash;
        const actualHash = validateStream.getHash();
        if (!expectHash || expectHash === actualHash) {
          resolve({
            hash: actualHash,
            resolved: mirrorPath ? `${mirrorPath}#${actualHash}` : null,
          });
        } else {
          reject(new SecurityError(
            `Bad hash. Expected ${expectHash} but got ${actualHash} `,
          ));
        }
      });

    return {validateStream, extractorStream};
  }

  async fetchFromLocal(pathname: ?string): Promise<FetchedOverride> {
    let {reference: ref, config} = this;

    // path to the local tarball
    let localTarball;
    let isOfflineTarball = false;

    const relativeFileLoc = pathname ? path.join(config.cwd, pathname) : null;
    if (relativeFileLoc && await fsUtil.exists(relativeFileLoc)) {
      // this is a reference to a file relative to the cwd
      localTarball = relativeFileLoc;
    } else {
      // generate a offline cache location
      const offlineMirrorPath = config.getOfflineMirrorPath() || '';
      localTarball = path.resolve(offlineMirrorPath, ref);
      isOfflineTarball = true;
    }

    if (!(await fsUtil.exists(localTarball))) {
      throw new MessageError(`${ref}: Tarball is not in network and can't be located in cache (${localTarball})`);
    }

    return new Promise((resolve, reject) => {
      let {validateStream, extractorStream} = this.createExtractor(null, resolve, reject);

      const cachedStream = fs.createReadStream(localTarball);

      cachedStream
        .pipe(validateStream)
        .pipe(extractorStream)
        .on('error', function(err) {
          let msg = `${err.message}. `;
          if (isOfflineTarball) {
            msg += `Mirror tarball appears to be corrupt. You can resolve this by running:\n\n` +
                   `  $ rm -rf ${localTarball}\n` +
                   '  $ yarn install';
          } else {
            msg += `Error decompressing ${localTarball}, it appears to be corrupt.`;
          }
          reject(new MessageError(msg));
        });
    });
  }

  fetchFromExternal(): Promise<FetchedOverride> {
    let {reference: ref} = this;

    return this.config.requestManager.request({
      url: ref,
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/octet-stream',
      },
      buffer: true,
      process: (req, resolve, reject) => {
        // should we save this to the offline cache?
        const mirrorPath = this.getMirrorPath();
        const tarballStorePath = path.join(this.dest, constants.TARBALL_FILENAME);
        const overwriteResolved = mirrorPath
          ? this.getRelativeMirrorPath(mirrorPath)
          : null;

        //
        let {
          validateStream,
          extractorStream,
        } = this.createExtractor(overwriteResolved, resolve, reject);

        //
        req.pipe(validateStream);

        validateStream
          .pipe(fs.createWriteStream(tarballStorePath))
          .on('error', reject);

        validateStream
          .pipe(extractorStream)
          .on('error', reject);
        if (mirrorPath) {
          validateStream
            .pipe(fs.createWriteStream(mirrorPath))
            .on('error', reject);
        }
      },
    });
  }

  _fetch(): Promise<FetchedOverride> {
    const {protocol, pathname} = url.parse(this.reference);
    if (protocol === null && typeof pathname === 'string') {
      return this.fetchFromLocal(pathname);
    } else {
      return this.fetchFromExternal();
    }
  }
}

export class LocalTarballFetcher extends TarballFetcher {
  _fetch(): Promise<FetchedOverride> {
    return this.fetchFromLocal(this.reference);
  }
}
