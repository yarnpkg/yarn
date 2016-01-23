/* @flow */

import type Reporter from "../reporters/_base"
import * as constants from "../constants";
import * as network from "./network";

let request = require("request");

let controlOffline = network.isOffline();

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
    [key: string]: Promise<Object | false>
  };

  /**
   * Queue up a request.
   */

  request(url: string): Promise<Object | false> {
    let cached = this.cache[url];
    if (cached) return cached;

    return this.cache[url] = new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject });
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

  isPossibleOfflineError(err: Error): boolean {
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
    requestOpts: {
      url: string,
      json: boolean,
      headers: {
        [key: string]: string
      }
    },
    opts: {
      reject: (err: Error) => void,
      resolve: (body: false | Object) => void
    }
  ) {
    request.get(requestOpts, (err, res, body) => {
      if (err) {
        if (this.isPossibleOfflineError(err)) {
          this.queueForOffline(requestOpts, opts);
          return;
        } else {
          opts.reject(err);
        }
      } else if (res.statusCode === 403) {
        opts.reject(new Error((body && body.message) || `Request ${requestOpts.url} returned a ${res.statusCode}`));
      } else {
        if (res.statusCode === 404) body = false;
        opts.resolve(body);
      }

      this.running--;
      this.shiftQueue();
    });
  }

  /**
   * Remove an item from the queue. Create it's request options and execute it.
   */

  shiftQueue() {
    if (this.running >= this.max) return;
    if (!this.queue.length) return;

    let opts = this.queue.shift();

    this.running++;
    this.execute({
      url: opts.url,
      json: true,
      headers: {
        "User-Agent": constants.USER_AGENT
      }
    }, opts);
  }
}
