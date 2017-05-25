/* @flow */

import type Reporter from '../reporters/base-reporter.js';
import type RequestManager, {RequestMethods} from '../util/request-manager.js';
import type Config from '../config.js';
import type {ConfigRegistries, RegistryNames} from './index.js';
import {registries} from './index.js';
import {removePrefix} from '../util/misc.js';

const objectPath = require('object-path');
const path = require('path');
const invariant = require('invariant');

export type RegistryRequestOptions = {
  method?: RequestMethods,
  auth?: Object,
  body?: mixed,
  buffer?: boolean,
  headers?: Object,
  process?: Function,
};

export type CheckOutdatedReturn = Promise<{
  wanted: string,
  latest: string,
  url: string,
}>;

export default class BaseRegistry {
  constructor(cwd: string, registries: ConfigRegistries, requestManager: RequestManager, reporter: Reporter) {
    this.reporter = reporter;
    this.requestManager = requestManager;
    this.registries = registries;
    this.config = {};
    this._folder = '';
    this.token = '';
    this.cwd = cwd;
  }

  // the filename to use for package metadata
  static filename: string;

  //
  reporter: Reporter;
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

  // Name of the folder where modules will be placed in,
  // for example 'node_modules'.
  _folder: string;

  /* eslint-disable consistent-return */
  get name(): RegistryNames {
    for (const name of Object.keys(registries)) {
      if (registries[name] === this.constructor) {
        return name;
      }
    }
    invariant(false, `registry ${this.constructor.name} not found`);
  }
  /* eslint-enable consistent-return */

  setToken(token: string) {
    this.token = token;
  }

  getOption(key: string): mixed {
    return this.config[key];
  }

  getAvailableRegistries(): Array<string> {
    const config = this.config;
    return Object.keys(config).reduce((registries, option) => {
      if (option === 'registry' || option.split(':')[1] === 'registry') {
        registries.push(config[option]);
      }
      return registries;
    }, []);
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

  /**
   * Folder name where the modules will be placed.
   * Relative to current working directory.
   */
  get folder(): string {
    return this._folder;
  }

  /**
   * Absolute folder path to place the modules in.
   */
  get loc(): string {
    return this.folder.length ? path.join(this.cwd, this.folder) : '';
  }

  async init(): Promise<void> {
    this.mergeEnv('yarn_');
    await this.loadConfig();
  }

  static normalizeConfig(config: Object): Object {
    for (const key in config) {
      config[key] = BaseRegistry.normalizeConfigOption(config[key]);
    }
    return config;
  }

  static normalizeConfigOption(val: any): any {
    if (val === 'true') {
      return true;
    } else if (val === 'false') {
      return false;
    } else {
      return val;
    }
  }

  mergeEnv(prefix: string) {
    // try environment variables
    for (const envKey in process.env) {
      let key = envKey.toLowerCase();

      // only accept keys prefixed with the prefix
      if (key.indexOf(prefix.toLowerCase()) < 0) {
        continue;
      }

      const val = BaseRegistry.normalizeConfigOption(process.env[envKey]);

      // remove config prefix
      key = removePrefix(key, prefix.toLowerCase());

      // replace dunders with dots
      key = key.replace(/__/g, '.');

      // replace underscores with dashes
      key = key.replace(/_/g, '-');

      // set it via a path
      objectPath.set(this.config, key, val);
    }
  }
}
