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

import * as fs from '../../src/util/fs.js';

const realRequest = require.requireActual('request');
const RealRequest = realRequest.Request;

const path = require('path');
const http = require('http');
const url = require('url');
const _fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', 'fixtures', 'request-cache');

function getRequestAlias(params: Object): string {
  const parts = url.parse(params.url);

  const pathname = cleanAlias(parts.pathname);
  const host = cleanAlias(parts.hostname);

  return path.join(params.method, host, pathname);
}

function cleanAlias(str: string): string {
  return str
    .replace(/@/g, '') // remove at signs
    .replace(/-+/g, '-') // replace multiple dashes with one
    .replace(/^-+/, '') // remove leading dashes
    .replace(/-+$/, ''); // remove trailing dashes
}

const RESPONSE_KEYS = [
  'headers',
  'httpVersion',
  'method',
  'rawHeaders',
  'rawTrailers',
  'statusCode',
  'statusMessage',
  'url',
];

export class Request extends RealRequest {
  init(params: Object) {
    if (!params) {
      return;
    }

    this._alias = getRequestAlias(params);
    this._dir = path.join(CACHE_DIR, this._alias);
    this._resLoc = path.join(this._dir, 'response.json');
    this._bodyLoc = path.join(this._dir, 'body');
    this.dests = [];

    this._init(params).catch((err) => {
      this.emit('err', err);
    });
  }

  _inited: boolean;

  async _hasValidCache(): Promise<boolean> {
    return await fs.exists(this._resLoc) && await fs.exists(this._bodyLoc);
  }

  async _init(params: Object): Promise<void> {
    if (await this._hasValidCache()) {
      return this._initCached(params);
    } else {
      return this._initReal(params);
    }
  }

  async _initCached(params: Object): Promise<void> {
    const resCached = await fs.readJson(this._resLoc);

    this.httpModule = {
      request: (reqOptions): http$ClientRequest => {
        let res = new http.IncomingMessage();
        Object.assign(res, resCached);
        _fs.createReadStream(this._bodyLoc).pipe(res);

        let req = new http.ClientRequest();
        req.emit('response', res);

        return req;
      },
    };

    RealRequest.prototype.init.call(this, params);
  }

  async _initReal(params: Object): Promise<void> {
    await fs.mkdirp(this._dir);

    let realParams = Object.assign({}, params, {json: false});
    realRequest(realParams, (err, res, body) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      // emit body
      this.emit('data', body);
      this.emit('end');
      this.emit('close');

      // write body
      _fs.writeFileSync(this._bodyLoc, body);

      // write response
      let resCache = {};
      for (let key of RESPONSE_KEYS) {
        resCache[key] = res[key];
      }
      _fs.writeFileSync(this._resLoc, JSON.stringify(resCache, null, '  '));

      //
      if (params.callback) {
        if (params.json) {
          body = JSON.parse(body.toString());
        }
        params.callback(err, res, body);
      }
    });
  }
}
