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
import type {HashStream} from '../util/crypto.js';
import * as crypto from '../util/crypto.js';
import BaseFetcher from './BaseFetcher.js';
import * as fsUtil from '../util/fs.js';

const through = require('through2');
const zlib = require('zlib');
const path = require('path');
const tar = require('tar');
const url = require('url');
const fs = require('fs');

export default class TarballFetcher extends BaseFetcher {
  async _fetch(dest: string): Promise<string> {
    let {reference: ref, hash, config, saveForOffline, registry} = this;

    const parts = url.parse(ref);

    // basic security check
    if (!hash) {
      if (parts.protocol === 'http:') {
        throw new SecurityError(`${ref}: Refusing to fetch tarball over plain HTTP without a hash`);
      }
    }

    // create an extractor
    function createExtractor(resolve: Function, reject: Function): {
      validateStream: HashStream,
      extractor: stream$Readable,
    } {
      const validateStream = crypto.hashStreamValidation();

      const extractor = tar.Extract({path: dest, strip: 1})
        .on('error', reject)
        .on('end', function() {
          const expectHash = hash;
          const actualHash = validateStream.getHash();
          if (!expectHash || expectHash === actualHash) {
            resolve(actualHash);
          } else {
            reject(new SecurityError(
              `Bad hash. Expected ${expectHash} but got ${actualHash} `,
            ));
          }
        });

      return {validateStream, extractor};
    }

    // offline mirror path
    if (parts.protocol === null) {
      // path to the local tarball
      let localTarball;
      let isOfflineTarball = false;

      const relativeFileLoc = parts.pathname && path.join(this.config.cwd, parts.pathname);
      if (relativeFileLoc && await fsUtil.exists(relativeFileLoc)) {
        // this is a reference to a file relative to the cwd
        localTarball = relativeFileLoc;
      } else {
        // generate a offline cache location
        localTarball = path.resolve(this.config.getOfflineMirrorPath(registry, null), ref);
        isOfflineTarball = true;
      }

      if (!(await fsUtil.exists(localTarball))) {
        throw new MessageError(`${ref}: Tarball is not in network and can't be located in cache`);
      }

      return new Promise((resolve, reject) => {
        let {validateStream, extractor} = createExtractor(resolve, reject);

        // flow gets confused with the pipe/on types chain
        const cachedStream: Object = fs.createReadStream(localTarball);

        const decompressStream = zlib.createUnzip();

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
          .pipe(decompressStream)
          .on('error', reject)
          .pipe(extractor);
      });
    }

    // http url
    return this.config.requestManager.request({
      url: ref,
      headers: {
        'Accept-Encoding': 'gzip',
      },
      process(req, resolve, reject) {
        let {validateStream, extractor} = createExtractor(resolve, reject);

        // should we save this to the offline cache?
        const mirrorPath = config.getOfflineMirrorPath(registry, ref);
        let mirrorTarballStream;
        if (mirrorPath && saveForOffline) {
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
        req
          .on('redirect', function() {
            if (hash) {
              return;
            }

            const href = this.uri.href;
            const parts = url.parse(href);
            if (parts.protocol === 'http:') {
              throw new SecurityError(
                `While downloading the tarball ${ref} we encountered a HTTP redirect of ${href}. ` +
                'This is not allowed unless a tarball hash is specified.',
              );
            }
          })
          .pipe(validateStream)
          .pipe(mirrorSaver)
          .pipe(zlib.createUnzip())
          .on('error', reject)
          .pipe(extractor);
      },
    });
  }
}
