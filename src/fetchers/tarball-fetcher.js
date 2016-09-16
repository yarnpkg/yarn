/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import type {HashStream} from '../util/crypto.js';
import * as constants from '../constants.js';
import * as crypto from '../util/crypto.js';
import BaseFetcher from './base-fetcher.js';
import * as fsUtil from '../util/fs.js';

const through = require('through2');
const zlib = require('zlib');
const path = require('path');
const tar = require('tar');
const url = require('url');
const fs = require('fs');

function hasGzipHeader(chunk: Buffer): boolean {
  return chunk[0] === 0x1F && chunk[1] === 0x8B && chunk[2] === 0x08;
}

function createUnzip(factory): any {
  let readHeader = false;
  let isGzip = false;

  let stream = through(function(chunk, enc, callback) {
    if (!readHeader) {
      readHeader = true;
      isGzip = hasGzipHeader(chunk);
      if (isGzip) {
        factory(stream.pipe(zlib.createUnzip()));
      } else {
        factory(stream);
      }
    }

    callback(null, chunk);
  });
  return stream;
}

export default class TarballFetcher extends BaseFetcher {
  async getResolvedFromCached(hash: string): Promise<?string> {
    let mirrorPath = this.getMirrorPath();
    if (!mirrorPath) {
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

    return `${this.getRelativeMirrorPath(mirrorPath)}#${hash}`;
  }

  getMirrorPath(): ?string {
    return this.config.getOfflineMirrorPath(this.reference);
  }

  getRelativeMirrorPath(mirrorPath: string): string {
    return path.relative(this.config.getOfflineMirrorPath(), mirrorPath);
  }

  createExtractor(mirrorPath: ?string, resolve: Function, reject: Function): {
    validateStream: HashStream,
    extractor: stream$Readable,
  } {
    const validateStream = crypto.hashStreamValidation();

    const extractor = tar.Extract({path: this.dest, strip: 1})
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

    return {validateStream, extractor};
  }

  async fetchFromLocal(parts: Object): Promise<FetchedOverride> {
    let {reference: ref, config} = this;

    // path to the local tarball
    let localTarball;
    let isOfflineTarball = false;

    const relativeFileLoc = parts.pathname && path.join(config.cwd, parts.pathname);
    if (relativeFileLoc && await fsUtil.exists(relativeFileLoc)) {
      // this is a reference to a file relative to the cwd
      localTarball = relativeFileLoc;
    } else {
      // generate a offline cache location
      localTarball = path.resolve(config.getOfflineMirrorPath(), ref);
      isOfflineTarball = true;
    }

    if (!(await fsUtil.exists(localTarball))) {
      throw new MessageError(`${ref}: Tarball is not in network and can't be located in cache`);
    }

    return new Promise((resolve, reject) => {
      let {validateStream, extractor} = this.createExtractor(null, resolve, reject);

      // flow gets confused with the pipe/on types chain
      const cachedStream: Object = fs.createReadStream(localTarball);

      const decompressStream = createUnzip((stream) => {
        stream
          .pipe(extractor)
          .on('error', reject);
      });

      cachedStream
        .pipe(validateStream)
        .pipe(decompressStream)
        .on('error', function(err) {
          let msg = `${err.message}. `;
          if (isOfflineTarball) {
            msg += `Mirror tarball appears to be corrupt. You can resolve this by running:\n\n` +
                   `  $ rm -rf ${localTarball}\n` +
                   '  $ kpm install --save';
          } else {
            msg += `Error decompressing ${localTarball}, it appears to be corrupt.`;
          }
          reject(new MessageError(msg));
        });
    });
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
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
        let mirrorTarballStream;
        let overwriteResolved;
        if (mirrorPath) {
          overwriteResolved = this.getRelativeMirrorPath(mirrorPath);
          mirrorTarballStream = fs.createWriteStream(mirrorPath);
          mirrorTarballStream.on('error', reject);
        }
        let tarballStoreStream = fs.createWriteStream(path.join(this.dest, constants.TARBALL_FILENAME));
        tarballStoreStream.on('error', reject);
        const saver = through(function(chunk, enc, callback) {
          if (mirrorTarballStream) {
            mirrorTarballStream.write(chunk, enc);
          }
          tarballStoreStream.write(chunk, enc);
          callback(null, chunk);
        });

        //
        let {validateStream, extractor} = this.createExtractor(overwriteResolved, resolve, reject);

        //
        req
          .pipe(validateStream)
          .pipe(saver)
          .on('error', reject)
          .pipe(createUnzip((stream) => {
            stream
              .pipe(extractor)
              .on('error', reject);
          }));
      },
    });
  }

  async _fetch(): Promise<FetchedOverride> {
    const parts = url.parse(this.reference);
    if (parts.protocol === null) {
      return this.fetchFromLocal(parts);
    } else {
      return this.fetchFromExternal();
    }
  }
}
