/* @flow */

import type Reporter from "../reporters/_base";
import * as constants from "../constants";
import * as network from "./network";

let Request = require("request").Request;

let controlOffline = network.isOffline();

declare class RequestError extends Error {
  code: string;
}

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
  offlineQueue: Array<Array<Object>>;
  queue: Array<Object>;
  max: number;
  cache: {
    [key: string]: Promise<any>
  };

  /**
   * Queue up a request.
   */

  request<T>(
    url: string,
    params?: {
      json?: boolean,
      headers?: {
        [name: string]: string
      },
      process?: (
        req: Request,
        resolve: (body: T) => void,
        reject: (err: Error) => void
      ) => void;
    } = {}
  ): Promise<T> {
    let cached = this.cache[url];
    if (cached) return cached;

    return this.cache[url] = new Promise((resolve, reject) => {
      this.queue.push({ url, params, resolve, reject });
      this.shiftQueue();
    });
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
    let possibleOfflineChange = !controlOffline && network.isOffline();

    if (err.code === "ENOTFOUND" && possibleOfflineChange) {
      // can't resolve a domain
      return true;
    }

    // TODO: detect timeouts

    return false;
  }

  /**
   * Queue up request arguments to be retryed. Start a network connectivity timer if there
   * isn't already one.
   */

  queueForOffline(...args: Array<any>) {
    if (this.offlineQueue.length) {
      this.reporter.warn("There appears to be trouble with your network connection. Retrying...");
      this.initOfflineRetry();
    }

    this.offlineQueue.push(args);
  }

  /**
   * Begin timers to retry failed requests when we possibly establish network connectivity
   * again.
   */

  initOfflineRetry() {
    let requeue = () => {
      let queue = this.offlineQueue;
      this.offlineQueue = [];
      for (let args of queue) this.execute(...args);
    };

    if (!controlOffline && network.isOffline()) {
      // we were online before but now we aren't so let's use that as our check
      let interval = setInterval(function () {
        if (!network.isOffline()) {
          clearInterval(interval);
          requeue();
        }
      }, 500);
    } else {
      // just try again in 3 seconds
      setTimeout(requeue, 3000);
    }
  }

  /**
   * Execute a request.
   */

  execute(
    params: {
      url: string,
      method: "GET",
      json?: boolean,
      headers: {
        [key: string]: string
      },
      process?: (
        req: Request,
        resolve: (body: any) => void,
        reject: (err: Error) => void,
      ) => void
    },
    opts: {
      reject: (err: any) => void,
      resolve: (body: any) => void
    }
  ) {
    let buildNext = (fn) => (data) => {
      fn(data);
      this.running--;
      this.shiftQueue();
    };

    let resolve = buildNext(opts.resolve);
    let reject  = buildNext(opts.reject);

    //

    let req = new Request(params);

    req.on("error", (err) => {
      if (this.isPossibleOfflineError(err)) {
        if (params.cleanup) params.cleanup();
        this.queueForOffline(params, opts);
      } else {
        reject(err);
      }
    });

    if (params.process) {
      params.process(req, resolve, reject);
    } else {
      req.on("complete", (res, body) => {
        if (res.statusCode === 403) {
          reject(new Error((body && body.message) || `Request ${params.url} returned a ${res.statusCode}`));
        } else {
          if (res.statusCode === 404) body = false;
          resolve(body);
        }
      });
    }
  }

  /**
   * Remove an item from the queue. Create it's request options and execute it.
   */

  shiftQueue() {
    if (this.running >= this.max) return;
    if (!this.queue.length) return;

    let opts = this.queue.shift();

    this.running++;
    this.execute(Object.assign({
      url: opts.url,
      method: "GET",
      headers: Object.assign({
        "User-Agent": constants.USER_AGENT
      }, opts.params.headers)
    }, opts.params), opts);
  }
}
