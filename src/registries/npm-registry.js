/* @flow */

import type RequestManager from '../util/request-manager.js';
import type {RegistryRequestOptions, CheckOutdatedReturn} from './base-registry.js';
import type Config from '../config.js';
import type {ConfigRegistries} from './index.js';
import * as fs from '../util/fs.js';
import NpmResolver from '../resolvers/registries/npm-resolver.js';
import Registry from './base-registry.js';
import {addSuffix} from '../util/misc';

const defaults = require('defaults');
const userHome = require('user-home');
const path = require('path');
const url = require('url');
const ini = require('ini');

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

function getGlobalPrefix(): string {
  if (process.env.PREFIX) {
    return process.env.PREFIX;
  } else if (process.platform === 'win32') {
    // c:\node\node.exe --> prefix=c:\node\
    return path.dirname(process.execPath);
  } else {
    // /usr/local/bin/node --> prefix=/usr/local
    let prefix = path.dirname(path.dirname(process.execPath));

    // destdir only is respected on Unix
    if (process.env.DESTDIR) {
      prefix = path.join(process.env.DESTDIR, prefix);
    }

    return prefix;
  }
}

export default class NpmRegistry extends Registry {
  constructor(cwd: string, registries: ConfigRegistries, requestManager: RequestManager) {
    super(cwd, registries, requestManager);
    this.folder = 'node_modules';
  }

  static filename = 'package.json';

  static escapeName(name: string): string {
    // scoped packages contain slashes and the npm registry expects them to be escaped
    return name.replace('/', '%2f');
  }

  request(pathname: string, opts?: RegistryRequestOptions = {}): Promise<*> {
    const registry = addSuffix(this.getRegistry(pathname), '/');
    const requestUrl = url.resolve(registry, pathname);
    const alwaysAuth = this.getScopedOption(registry.replace(/^https?:/, ''), 'always-auth')
                    || this.getOption('always-auth');

    const headers = {};
    if (this.token || (alwaysAuth && requestUrl.startsWith(registry))) {
      headers.authorization = this.getAuth(pathname);
    }

    return this.requestManager.request({
      url: requestUrl,
      method: opts.method,
      body: opts.body,
      auth: opts.auth,
      headers,
      json: !opts.buffer,
      buffer: opts.buffer,
      process: opts.process,
      gzip: true,
    });
  }

  async checkOutdated(config: Config, name: string, range: string): CheckOutdatedReturn {
    const req = await this.request(name);
    if (!req) {
      throw new Error('couldnt find ' + name);
    }

    return {
      latest: req['dist-tags'].latest,
      wanted: (await NpmResolver.findVersionInRegistryResponse(config, range, req)).version,
    };
  }

  async getPossibleConfigLocations(filename: string): Promise<Array<[boolean, string, string]>> {
    const possibles = [
      [false, path.join(this.cwd, filename)],
      [true, path.join(userHome, filename)],
      [false, path.join(getGlobalPrefix(), filename)],
    ];

    const foldersFromRootToCwd = this.cwd.split(path.sep);
    while (foldersFromRootToCwd.length > 1) {
      possibles.push([false, path.join(foldersFromRootToCwd.join(path.sep), filename)]);
      foldersFromRootToCwd.pop();
    }

    const actuals = [];
    for (const [isHome, loc] of possibles) {
      if (await fs.exists(loc)) {
        actuals.push([
          isHome,
          loc,
          await fs.readFile(loc),
        ]);
      }
    }
    return actuals;
  }

  async loadConfig(): Promise<void> {
    // docs: https://docs.npmjs.com/misc/config
    this.mergeEnv('npm_config_');

    for (const [, loc, file] of await this.getPossibleConfigLocations('.npmrc')) {
      const config = ini.parse(file);

      // normalize offline mirror path relative to the current npmrc
      let offlineLoc = config['yarn-offline-mirror'];
      // old kpm compatibility
      if (config['kpm-offline-mirror']) {
        offlineLoc = config['kpm-offline-mirror'];
        delete config['kpm-offline-mirror'];
      }
      // don't normalize if we already have a mirror path
      if (!this.config['yarn-offline-mirror'] && offlineLoc) {
        const mirrorLoc = config['yarn-offline-mirror'] = path.resolve(path.dirname(loc), offlineLoc);
        await fs.mkdirp(mirrorLoc);
      }

      defaults(this.config, config);
    }
  }

  getScope(packageName: string): string {
    return !packageName || packageName[0] !== '@' ? '' : packageName.split(/\/|%2f/)[0];
  }

  getRegistry(packageName: string): string {
    // Try scoped registry, and default registry
    for (const scope of [this.getScope(packageName), '']) {
      const registry = this.getScopedOption(scope, 'registry')
                    || this.registries.yarn.getScopedOption(scope, 'registry');
      if (registry) {
        return String(registry);
      }
    }

    return DEFAULT_REGISTRY;
  }

  getAuth(packageName: string): string {
    if (this.token) {
      return this.token;
    }

    for (let registry of [this.getRegistry(packageName), '', DEFAULT_REGISTRY]) {
      registry = registry.replace(/^https?:/, '');

      // Check for bearer token.
      let auth = this.getScopedOption(registry, '_authToken');
      if (auth) {
        return `Bearer ${String(auth)}`;
      }

      // Check for basic auth token.
      auth = this.getScopedOption(registry, '_auth');
      if (auth) {
        return `Basic ${String(auth)}`;
      }

      // Check for basic username/password auth.
      const username = this.getScopedOption(registry, 'username');
      const password = this.getScopedOption(registry, '_password');
      if (username && password) {
        const pw = new Buffer(String(password), 'base64').toString();
        return 'Basic ' + new Buffer(String(username) + ':' + pw).toString('base64');
      }
    }

    return '';
  }

  getScopedOption(scope: string, option: string): mixed {
    return this.getOption(scope + (scope ? ':' : '') + option);
  }
}
