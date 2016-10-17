/* @flow */

import type RequestManager, {RequestMethods} from '../util/request-manager.js';
import type Config from '../config.js';
import type {ConfigRegistries} from './index.js';
import {removePrefix} from '../util/misc.js';

const objectPath = require('object-path');
const path = require('path');

export type RegistryRequestOptions = {
  method?: RequestMethods,
  auth?: Object,
  body?: mixed,
  buffer?: bool,
  process?: Function
};

export type CheckOutdatedReturn = Promise<{
  wanted: string,
  latest: string,
}>;

export default class BaseRegistry {
  constructor(cwd: string, registries: ConfigRegistries, requestManager: RequestManager) {
    this.requestManager = requestManager;
    this.registries = registries;
    this.config = {};
    this.folder = '';
    this.token = '';
    this.loc = '';
    this.cwd = cwd;
  }

  // the filename to use for package metadata
  static filename: string;

  //
  registries: ConfigRegistries;

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

  getOption(key: string): mixed {
    return this.config[key];
  }

  loadConfig(): Promise<void> {
    return Promise.resolve();
  }

  checkOutdated(config: Config, name: string, range: string): CheckOutdatedReturn {
    return Promise.reject(new Error('unimplemented'));
  }

  saveHomeConfig(config: Object): Promise<void> {
    return Promise.reject(new Error('unimplemented'));
  }

  request(pathname: string, opts?: RegistryRequestOptions = {}): Promise<*> {
    return this.requestManager.request({
      url: pathname,
      ...opts,
    });
  }

  async init(): Promise<void> {
    this.mergeEnv('yarn_');
    await this.loadConfig();
    this.loc = path.join(this.cwd, this.folder);
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
      objectPath.set(this.config, key, val);
    }
  }
}
