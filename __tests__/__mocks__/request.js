/* @flow */

import type {ClientRequest} from 'http';
import type {ReadStream} from 'fs';

// TODO: create flow-typed libdefs for the 'request' module
//       for now this will do its job
type RequestModule = {
  Request: any,
};

const realRequest: RequestModule = (require: any).requireActual('request');
const RealRequest = realRequest.Request;

const mkdirp = require('mkdirp');
const https = require('https');
const http = require('http');
const path = require('path');
const url = require('url');
const fs = require('fs');

const CACHE_DIR = path.join(__dirname, '..', 'fixtures', 'request-cache');

let authedRequests = [];

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

module.exports.__resetAuthedRequests = (): void => {
  authedRequests = [];
};
module.exports.__getAuthedRequests = (): Array<Object> => authedRequests;

const httpMock = {
  request(options: Object, callback?: ?Function): ClientRequest {
    const alias = getRequestAlias(options);
    const loc = path.join(CACHE_DIR, `${alias}.bin`);
    // allow the client to bypass the local fs fixture cache by adding nocache to the query string
    const allowCache = options.uri.href.indexOf('nocache') == -1;

    // TODO better way to do this
    const httpModule = options.uri.href.startsWith('https:') ? https : http;

    // expose authorized requests to the tests for assertion
    if (options.headers.authorization) {
      authedRequests.push({
        headers: options.headers,
        url: options.uri.href,
      });
    }

    if (allowCache && fs.existsSync(loc)) {
      // cached
      options.agent = null;
      options.socketPath = null;
      options.createConnection = (): ReadStream => {
        const socket = fs.createReadStream(loc);
        socket.connecting = false;
        socket.setTimeout = () => {};
        return socket;
      };
      return httpModule.request(options, callback);
    } else {
      // not cached
      const req = httpModule.request(options, callback);
      let errored = false;
      const bufs = [];
      // to track situations when CI gets stalled because of many network requests
      if (options.uri.href.indexOf('localhost') === -1) {
        console.warn('No request cache for', options.uri.href);
      }

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
