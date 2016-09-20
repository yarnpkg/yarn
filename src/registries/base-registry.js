/* @flow */

import type RequestManager, {RequestMethods} from '../util/request-manager.js';
import {removePrefix} from '../util/misc.js';
import * as fs from '../util/fs.js';

const path = require('path');
const _ = require('lodash');

export type RegistryRequestOptions = {
  method?: RequestMethods,
  body?: any,
};

export default class BaseRegistry {
  constructor(cwd: string, requestManager: RequestManager) {
    this.requestManager = requestManager;
    this.config = {};
    this.folder = '';
    this.token = '';
    this.loc = '';
    this.cwd = cwd;
  }

  // whether to always flatten the graph for this registry, will cause manual conflict resolution
  static alwaysFlatten = false;

  // the filename to use for package metadata
  static filename: string;

  //
  requestManager: RequestManager;

  //
  token: string;

  //
  cwd: string;

  //
  config: Object;

  // absolute folder name to insert modules
  loc: string;

  // relative folder name to put these modules
  folder: string;

  setToken(token: string) {
    this.token = token;
  }

  loadConfig(): Promise<void> {
    return Promise.resolve();
  }

  saveHomeConfig(config: Object): Promise<void> {
    return Promise.reject(new Error('unimplemented'));
  }

  request(pathname: string, opts?: RegistryRequestOptions = {}): Promise<Object | false> {
    pathname;
    opts;
    return Promise.reject(new Error('unimplemented'));
  }

  async init(): Promise<void> {
    this.mergeEnv('yarn_');
    await this.loadConfig();

    // find in upper directories
    let loc = await fs.find(this.folder, this.cwd);

    // default to folder
    loc = loc || path.join(this.cwd, this.folder);

    // set output directory
    this.loc = loc;
  }

  mergeEnv(prefix: string) {
    // try environment variables
    for (let key in process.env) {
      key = key.toLowerCase();

      // only accept keys prefixed with the prefix
      if (key.indexOf(prefix) < 0) {
        continue;
      }

      const val = process.env[key];

      // remove bower prefix
      key = removePrefix(key, prefix);

      // replace dunders with dots
      key = key.replace(/__/g, '.');

      // replace underscores with dashes
      key = key.replace(/_/g, '-');

      // set it via a path
      _.set(this.config, key, val);
    }
  }
}
