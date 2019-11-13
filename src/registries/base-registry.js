/* @flow */

import type Reporter from '../reporters/base-reporter.js';
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
  buffer?: boolean,
  headers?: Object,
  process?: Function,
  registry?: string,
  unfiltered?: boolean,
};

export type CheckOutdatedReturn = Promise<{
  wanted: string,
  latest: string,
  url: string,
}>;

export default class BaseRegistry {
  constructor(
    cwd: string,
    registries: ConfigRegistries,
    requestManager: RequestManager,
    reporter: Reporter,
    enableDefaultRc: boolean,
    extraneousRcFiles: Array<string>,
  ) {
    this.reporter = reporter;
    this.requestManager = requestManager;
    this.registries = registries;
    this.config = {};
    this.folder = '';
    this.token = '';
    this.loc = '';
    this.cwd = cwd;
    this.enableDefaultRc = enableDefaultRc;
    this.extraneousRcFiles = extraneousRcFiles;
  }

  // the filename to use for package metadata
  static filename: string;

  //
  enableDefaultRc: boolean;
  extraneousRcFiles: Array<string>;

  //
  reporter: Reporter;
  //
  registries: ConfigRegistries;

  //
  requestManager: RequestManager;

  //
  token: string;

  //
  otp: string;

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

  setOtp(otp: string) {
    this.otp = otp;
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

  async init(overrides: Object = {}): Promise<void> {
    this.mergeEnv('yarn_');
    await this.loadConfig();

    for (const override of Object.keys(overrides)) {
      const val = overrides[override];

      if (val !== undefined) {
        this.config[override] = val;
      }
    }
    this.loc = path.join(this.cwd, this.folder);
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
      if (key.indexOf(prefix.toLowerCase()) !== 0) {
        continue;
      }

      const val = BaseRegistry.normalizeConfigOption(process.env[envKey]);

      // remove config prefix
      key = removePrefix(key, prefix.toLowerCase());

      // replace dunders with dots
      key = key.replace(/__/g, '.');

      // replace underscores with dashes ignoring keys that start with an underscore
      key = key.replace(/([^_])_/g, '$1-');

      // set it via a path
      objectPath.set(this.config, key, val);
    }
  }
}
