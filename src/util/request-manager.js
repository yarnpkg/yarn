/* @flow */

import type {Reporter} from '../reporters/index.js';
import {MessageError} from '../errors.js';
import BlockingQueue from './blocking-queue.js';
import * as constants from '../constants.js';
import * as network from './network.js';
import map from '../util/map.js';

import typeof * as RequestModuleT from 'request';
import type RequestT from 'request';

const RequestCaptureHar = require('request-capture-har');
const invariant = require('invariant');
const url = require('url');
const fs = require('fs');

const successHosts = map();
const controlOffline = network.isOffline();

interface RequestError extends Error {
  hostname?: ?string,
  code?: ?string,
}

export type RequestMethods = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE';

type RequestParams<T> = {
  url: string,
  auth?: {
    email?: string,
    username?: string,
    password?: string,
    token?: string,
  },
  buffer?: boolean,
  method?: RequestMethods,
  queue?: BlockingQueue,
  json?: boolean,
  body?: mixed,
  proxy?: string,
  encoding?: ?string,
  ca?: Array<string>,
  forever?: boolean,
  strictSSL?: boolean,
  headers?: {
    [name: string]: string
  },
  process?: (
    req: RequestT,
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
    this.offlineNoRequests = false;
    this._requestCaptureHar = null;
    this._requestModule = null;
    this.offlineQueue = [];
    this.captureHar = false;
    this.httpsProxy = null;
    this.ca = null;
    this.httpProxy = null;
    this.strictSSL = true;
    this.userAgent = '';
    this.reporter = reporter;
    this.running = 0;
    this.queue = [];
    this.cache = {};
    this.max = constants.NETWORK_CONCURRENCY;
  }

  offlineNoRequests: boolean;
  captureHar: boolean;
  userAgent: string;
  reporter: Reporter;
  running: number;
  httpsProxy: ?string;
  httpProxy: ?string;
  strictSSL: boolean;
  ca: ?Array<string>;
  offlineQueue: Array<RequestOptions>;
  queue: Array<Object>;
  max: number;
  cache: {
    [key: string]: Promise<any>
  };

  _requestCaptureHar: ?RequestCaptureHar;
  _requestModule: ?RequestModuleT;

  setOptions(opts: {
    userAgent?: string,
    offline?: boolean,
    captureHar?: boolean,
    httpProxy?: string,
    httpsProxy?: string,
    strictSSL?: boolean,
    cafile?: string,
  }) {
    if (opts.userAgent != null) {
      this.userAgent = opts.userAgent;
    }

    if (opts.offline != null) {
      this.offlineNoRequests = opts.offline;
    }

    if (opts.captureHar != null) {
      this.captureHar = opts.captureHar;
    }

    if (opts.httpProxy != null) {
      this.httpProxy = opts.httpProxy;
    }

    if (opts.httpsProxy != null) {
      this.httpsProxy = opts.httpsProxy;
    }

    if (opts.strictSSL !== null && typeof opts.strictSSL !== 'undefined') {
      this.strictSSL = opts.strictSSL;
    }

    if (opts.cafile != null && opts.cafile != '') {
      // The CA bundle file can contain one or more certificates with comments/text between each PEM block.
      // tls.connect wants an array of certificates without any comments/text, so we need to split the string
      // and strip out any text in between the certificates
      try {
        const bundle = fs.readFileSync(opts.cafile).toString();
        const hasPemPrefix = (block) => block.startsWith('-----BEGIN ');
        this.ca = bundle.split(/(-----BEGIN .*\r?\n[^-]+\r?\n--.*)/).filter(hasPemPrefix);
      } catch (err) {
        this.reporter.error(`Could not open cafile: ${err.message}`);
      }
    }
  }

  /**
   * Lazy load `request` since it is exceptionally expensive to load and is
   * often not needed at all.
   */

  _getRequestModule(): RequestModuleT {
    if (!this._requestModule) {
      const request = require('request');
      if (this.captureHar) {
        this._requestCaptureHar = new RequestCaptureHar(request);
        this._requestModule = this._requestCaptureHar.request.bind(this._requestCaptureHar);
      } else {
        this._requestModule = request;
      }
    }
    return this._requestModule;
  }

  /**
   * Queue up a request.
   */

  request<T>(params: RequestParams<T>): Promise<T> {
    if (this.offlineNoRequests) {
      return Promise.reject(new MessageError("Can't make a request in offline mode"));
    }

    const cached = this.cache[params.url];
    if (cached) {
      return cached;
    }

    params.method = params.method || 'GET';
    params.forever = true;
    params.retryAttempts = 0;
    params.strictSSL = this.strictSSL;
    
    params.headers = Object.assign({
      'User-Agent': this.userAgent,
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
    if (this._requestCaptureHar != null) {
      this._requestCaptureHar.clear();
    }
  }

  /**
   * Check if an error is possibly due to lost or poor network connectivity.
   */

  isPossibleOfflineError(err: RequestError): boolean {
    const {code, hostname} = err;
    if (!code) {
      return false;
    }

    // network was previously online but now we're offline
    const possibleOfflineChange = !controlOffline && !network.isOffline();
    if (code === 'ENOTFOUND' && possibleOfflineChange) {
      // can't resolve a domain
      return true;
    }

    // used to be able to resolve this domain! something is wrong
    if (code === 'ENOTFOUND' && hostname && successHosts[hostname]) {
      // can't resolve this domain but we've successfully resolved it before
      return true;
    }

    // network was previously offline and we can't resolve the domain
    if (code === 'ENOTFOUND' && controlOffline) {
      return true;
    }

    // connection was reset or dropped
    if (code === 'ECONNRESET') {
      return true;
    }

    return false;
  }

  /**
   * Queue up request arguments to be retried. Start a network connectivity timer if there
   * isn't already one.
   */

  queueForOffline(opts: RequestOptions) {
    if (!this.offlineQueue.length) {
      this.reporter.warn(this.reporter.lang('offlineRetrying'));
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

    const buildNext = (fn) => (data) => {
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
    let calledOnError = false;
    const onError = (err) => {
      if (calledOnError) {
        return;
      }
      calledOnError = true;

      const attempts = params.retryAttempts || 0;
      if (attempts < 5 && this.isPossibleOfflineError(err)) {
        params.retryAttempts = attempts + 1;
        if (typeof params.cleanup === 'function') {
          params.cleanup();
        }
        this.queueForOffline(opts);
      } else {
        reject(err);
      }
    };

    if (!params.process) {
      const parts = url.parse(params.url);

      params.callback = function(err, res, body) {
        if (err) {
          onError(err);
          return;
        }

        successHosts[parts.hostname] = true;

        if (body && typeof body.error === 'string') {
          reject(new Error(body.error));
          return;
        }

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

    if (params.buffer) {
      params.encoding = null;
    }

    let proxy = this.httpProxy;
    if (params.url.startsWith('https:')) {
      proxy = this.httpsProxy || proxy;
    }
    if (proxy) {
      params.proxy = proxy;
    }

    if (this.ca != null) {
      params.ca = this.ca;
    }

    const request = this._getRequestModule();
    const req = request(params);

    req.on('error', onError);

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

  saveHar(filename: string) {
    if (!this.captureHar) {
      throw new Error('RequestManager was not setup to capture HAR files');
    }
    // No request may have occurred at all.
    this._getRequestModule();
    invariant(this._requestCaptureHar != null, 'request-capture-har not setup');
    this._requestCaptureHar.saveHar(filename);
  }
}
