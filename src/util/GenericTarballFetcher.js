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

const zlib = require('zlib');
const tar = require('tar');
const url = require('url');
const Request = require('request').Request;
import {SecurityError, MessageError} from '../errors.js';

import {USER_AGENT} from '../constants';

export default class GenericTarballFetcher {

  constructor() {
  }

  async fetch(ref: string, dest: string): Promise<string> {
    const parts = url.parse(ref);
    if (parts.protocol === 'http:') {
      throw new SecurityError(`${ref}: Refusing to fetch tarball over plain HTTP without a hash`);
    }

    return new Promise((resolve, reject) => {
      const req = new Request({
        url: ref,
        headers: {
          'Accept': 'application/octet-stream',
          'Accept-Encoding': 'gzip',
          'user-agent': USER_AGENT,
        },
      });
      req
        .on('redirect', function() {
          const href = this.uri.href;
          const parts = url.parse(href);
          if (parts.protocol === 'http:') {
            throw new SecurityError(
              `While downloading the tarball ${ref} we encountered a HTTP redirect of ${href}. ` +
              'This is not allowed unless a tarball hash is specified.',
            );
          }
        })
        .on('response', function(response) {
          if (response.statusCode !== 200) {
            const errMsg = `Request ${ref} returned a ${response.statusCode}`;
            reject(new MessageError(errMsg));
          }
        })
        .pipe(zlib.createUnzip())
        .pipe(tar.Extract({path: dest, strip: 1}))
        .on('error', reject)
        .on('end', function() {
          resolve(dest);
        });

    });
  }
}
