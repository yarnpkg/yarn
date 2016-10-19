/* @flow */

import type {ClientRequest} from 'http';
import type {ReadStream} from 'fs';

const realRequest = require.requireActual('request');
const RealRequest = realRequest.Request;

const mkdirp = require('mkdirp');
const https = require('https');
const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', 'fixtures', 'request-cache');

function getRequestAlias(params: Object): string {
  const parts = url.parse(params.path);
  const pathname = cleanAlias(parts.pathname);

  const host = cleanAlias(params.host || params.hostname);

  return path.join(params.method, host, pathname);
}

function cleanAlias(str: string): string {
  return str
    .replace(/@/g, '') // remove at signs
    .replace(/-+/g, '-') // replace multiple dashes with one
    .replace(/^-+/, '') // remove leading dashes
    .replace(/-+$/, ''); // remove trailing dashes
}

class Request extends RealRequest {
  init(params: Object) {
    RealRequest.prototype.init.call(this, params);
    this.httpModule = httpMock;
  }
}

module.exports = function(params: Object): Request {
  return new Request(params);
};

module.exports.Request = Request;

const httpMock = {
  request(options: Object, callback?: ?Function): ClientRequest {
    const alias = getRequestAlias(options);
    const loc = path.join(CACHE_DIR, `${alias}.bin`);
    // allow the client to bypass the local fs fixture cache by adding nocache to the query string
    const allowCache = options.uri.href.indexOf('nocache') == -1;

    // TODO better way to do this
    const httpModule = options.uri.href.startsWith('https:') ? https : http;

    if (allowCache && fs.existsSync(loc)) {
      // cached
      options.agent = null;
      options.socketPath = null;
      options.createConnection = (): ReadStream => {
        return fs.createReadStream(loc);
      };
      return httpModule.request(options, callback);
    } else {
      // not cached
      const req = httpModule.request(options, callback);
      let errored = false;
      const bufs = [];

      req.once('socket', function(socket) {
        socket.setMaxListeners(Infinity);
        socket.on('data', function(buf) {
          bufs.push(buf);
        });
      });

      req.on('error', function() {
        errored = true;
      });

      req.on('response', function(res) {
        if (res.statusCode >= 400) {
          errored = true;
        }
        if (errored) {
          return;
        }

        res.on('end', function() {
          mkdirp.sync(path.dirname(loc));
          fs.writeFileSync(loc, Buffer.concat(bufs));
        });
      });

      return req;
    }
  },
};
