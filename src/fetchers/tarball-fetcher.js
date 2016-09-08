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

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import type {HashStream} from '../util/crypto.js';
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
    let {reference: ref, config, registry} = this;

    // path to the local tarball
    let localTarball;
    let isOfflineTarball = false;

    const relativeFileLoc = parts.pathname && path.join(config.cwd, parts.pathname);
    if (relativeFileLoc && await fsUtil.exists(relativeFileLoc)) {
      // this is a reference to a file relative to the cwd
      localTarball = relativeFileLoc;
    } else {
      // generate a offline cache location
      localTarball = path.resolve(config.getOfflineMirrorPath(registry, null), ref);
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
          .on('error', reject)
          .pipe(extractor);
      });

      // nicer errors for corrupted compressed tarballs
      decompressStream.on('error', function(err) {
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

      cachedStream
        .pipe(validateStream)
        .pipe(decompressStream);
    });
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    let {reference: ref, config, registry} = this;

    return this.config.requestManager.request({
      url: ref,
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/octet-stream',
      },
      buffer: true,
      process: (req, resolve, reject) => {
        // should we save this to the offline cache?
        const mirrorPath = config.getOfflineMirrorPath(registry, ref);
        let mirrorTarballStream;
        let overwriteResolved;
        if (mirrorPath) {
          overwriteResolved = path.relative(config.getOfflineMirrorPath(registry), mirrorPath);
          mirrorTarballStream = fs.createWriteStream(mirrorPath);
          mirrorTarballStream.on('error', reject);
        }
        const mirrorSaver = through(function(chunk, enc, callback) {
          if (mirrorTarballStream) {
            mirrorTarballStream.write(chunk, enc);
          }
          callback(null, chunk);
        });

        //
        let {validateStream, extractor} = this.createExtractor(overwriteResolved, resolve, reject);

        //
        req
          .pipe(validateStream)
          .pipe(mirrorSaver)
          .pipe(createUnzip((stream) => {
            stream
              .on('error', reject)
              .pipe(extractor);
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
