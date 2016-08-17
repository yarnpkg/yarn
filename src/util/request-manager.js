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

import type {Reporter} from '../reporters/index.js';
import BlockingQueue from './blocking-queue.js';
import * as constants from '../constants.js';
import * as network from './network.js';
import map from '../util/map.js';

const Request = require('request').Request;
const url = require('url');

const successHosts = map();
const controlOffline = network.isOffline();

declare class RequestError extends Error {
  hostname: string,
  code: string,
}

type RequestParams<T> = {
  url: string,
  method?: "GET" | "HEAD" | "POST" | "PUT",
  queue?: BlockingQueue,
  json?: boolean,
  forever?: boolean,
  headers?: {
    [name: string]: string
  },
  process?: (
    req: Request,
    resolve: (body: T) => void,
    reject: (err: Error) => void
  ) => void,
  callback?: (err: ?Error, res: any, body: any) => void,
  retryAttempts?: number
};

type RequestOptions = {
  params: RequestParams<Object>,
  resolve: (body: any) => void,
  reject: (err: any) => void
};

export default class RequestManager {
  constructor(reporter: Reporter) {
    this.offlineQueue = [];
    this.reporter     = reporter;
    this.running      = 0;
    this.queue        = [];
    this.cache        = {};
    this.max          = constants.NETWORK_CONCURRENCY;
  }

  reporter: Reporter;
  running: number;
  offlineQueue: Array<RequestOptions>;
  queue: Array<Object>;
  max: number;
  cache: {
    [key: string]: Promise<any>
  };

  /**
   * Queue up a request.
   */

  request<T>(params: RequestParams<T>): Promise<T> {
    const cached = this.cache[params.url];
    if (cached) {
      return cached;
    }

    params.method = params.method || 'GET';
    params.forever = true;
    params.retryAttempts = 0;

    params.headers = Object.assign({
      'User-Agent': constants.USER_AGENT,
    }, params.headers);

    const promise = new Promise((resolve, reject) => {
      this.queue.push({params, resolve, reject});
      this.shiftQueue();
    });

    // we can't cache a request with a processor
    if (!params.process) {
      this.cache[params.url] = promise;
    }

    return promise;
  }

  /**
   * Clear the request cache. This is important as we cache all HTTP requests so you'll
   * want to do this as soon as you can.
   */

  clearCache() {
    this.cache = {};
  }

  /**
   * Check if an error is possibly due to lost or poor network connectivity.
   */

  isPossibleOfflineError(err: RequestError): boolean {
    // network was previously online but now we're offline
    const possibleOfflineChange = !controlOffline && !network.isOffline();
    if (err.code === 'ENOTFOUND' && possibleOfflineChange) {
      // can't resolve a domain
      return true;
    }

    // used to be able to resolve this domain! something is wrong
    if (err.code === 'ENOTFOUND' && successHosts[err.hostname]) {
      // can't resolve this domain but we've successfully resolved it before
      return true;
    }

    // network was previously offline and we can't resolve the domain
    if (err.code === 'ENOTFOUND' && controlOffline) {
      return true;
    }

    // TODO: detect timeouts

    return false;
  }

  /**
   * Queue up request arguments to be retried. Start a network connectivity timer if there
   * isn't already one.
   */

  queueForOffline(opts: RequestOptions) {
    if (!this.offlineQueue.length) {
      this.reporter.warn('There appears to be trouble with your network connection. Retrying...');
      this.initOfflineRetry();
    }

    this.offlineQueue.push(opts);
  }

  /**
   * Begin timers to retry failed requests when we possibly establish network connectivity
   * again.
   */

  initOfflineRetry() {
    setTimeout(() => {
      const queue = this.offlineQueue;
      this.offlineQueue = [];
      for (const opts of queue) {
        this.execute(opts);
      }
    }, 3000);
  }

  /**
   * Execute a request.
   */

  execute(opts: RequestOptions) {
    const {params} = opts;

    const buildNext = (fn): Function => (data) => {
      fn(data);
      this.running--;
      this.shiftQueue();
    };

    const resolve = buildNext(opts.resolve);

    const rejectNext = buildNext(opts.reject);
    const reject = function(err) {
      err.message = `${params.url}: ${err.message}`;
      rejectNext(err);
    };

    //

    if (!params.process) {
      const parts = url.parse(params.url);

      params.callback = function(err, res, body) {
        if (err) {
          return; // will be handled by the `error` event handler
        }

        successHosts[parts.hostname] = true;

        if (res.statusCode === 403) {
          const errMsg = (body && body.message) || `Request ${params.url} returned a ${res.statusCode}`;
          reject(new Error(errMsg));
        } else {
          if (res.statusCode === 400 || res.statusCode === 404) {
            body = false;
          }
          resolve(body);
        }
      };
    }

    const req = new Request(params);

    req.on('error', (err) => {
      const attempts = params.retryAttempts || 0;
      if (attempts < 5 && this.isPossibleOfflineError(err)) {
        params.retryAttempts = attempts + 1;
        if (params.cleanup) {
          params.cleanup();
        }
        this.queueForOffline(opts);
      } else {
        reject(err);
      }
    });

    const queue = params.queue;
    if (queue) {
      req.on('data', queue.stillActive.bind(queue));
    }

    if (params.process) {
      params.process(req, resolve, reject);
    }
  }

  /**
   * Remove an item from the queue. Create it's request options and execute it.
   */

  shiftQueue() {
    if (this.running >= this.max || !this.queue.length) {
      return;
    }

    const opts = this.queue.shift();

    this.running++;
    this.execute(opts);
  }
}
