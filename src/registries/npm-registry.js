/* @flow */

import type Reporter from '../reporters/base-reporter.js';
import type RequestManager from '../util/request-manager.js';
import type {RegistryRequestOptions, CheckOutdatedReturn} from './base-registry.js';
import type Config from '../config.js';
import type {ConfigRegistries} from './index.js';
import * as fs from '../util/fs.js';
import NpmResolver from '../resolvers/registries/npm-resolver.js';
import envReplace from '../util/env-replace.js';
import Registry from './base-registry.js';
import {addSuffix, removePrefix} from '../util/misc';
import isRequestToRegistry from './is-request-to-registry.js';

const userHome = require('../util/user-home-dir').default;
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
  constructor(cwd: string, registries: ConfigRegistries, requestManager: RequestManager, reporter: Reporter) {
    super(cwd, registries, requestManager, reporter);
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
      || this.getOption('always-auth')
      || removePrefix(requestUrl, registry)[0] === '@';

    const headers = Object.assign({
      'Accept': 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
    }, opts.headers);
    if (this.token || (alwaysAuth && isRequestToRegistry(requestUrl, registry))) {
      const authorization = this.getAuth(pathname);
      if (authorization) {
        headers.authorization = authorization;
      }
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
    const req = await this.request(NpmRegistry.escapeName(name));
    if (!req) {
      throw new Error('couldnt find ' + name);
    }

    const {repository, homepage} = req;
    const url = homepage || (repository && repository.url) || '';

    return {
      latest: req['dist-tags'].latest,
      wanted: (await NpmResolver.findVersionInRegistryResponse(config, range, req)).version,
      url,
    };
  }

  async getPossibleConfigLocations(
      filename: string,
      reporter: Reporter,
      ): Promise<Array<[boolean, string, string]>> {
    const possibles = [
      [false, path.join(this.cwd, filename)],
      [true, this.config.userconfig || path.join(userHome, filename)],
      [false, path.join(getGlobalPrefix(), filename)],
    ];

    const foldersFromRootToCwd = this.cwd.split(path.sep);
    while (foldersFromRootToCwd.length > 1) {
      possibles.push([false, path.join(foldersFromRootToCwd.join(path.sep), filename)]);
      foldersFromRootToCwd.pop();
    }

    const actuals = [];
    for (const [isHome, loc] of possibles) {
      reporter.verbose(reporter.lang('configPossibleFile', loc));
      if (await fs.exists(loc)) {
        reporter.verbose(reporter.lang('configFileFound', loc));
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

    for (const [, loc, file] of await this.getPossibleConfigLocations('.npmrc', this.reporter)) {
      const config = Registry.normalizeConfig(ini.parse(file));
      for (const key: string in config) {
        config[key] = envReplace(config[key]);
      }

      // normalize offline mirror path relative to the current npmrc
      const offlineLoc = config['yarn-offline-mirror'];
      // don't normalize if we already have a mirror path
      if (!this.config['yarn-offline-mirror'] && offlineLoc) {
        const mirrorLoc = config['yarn-offline-mirror'] = path.resolve(path.dirname(loc), offlineLoc);
        await fs.mkdirp(mirrorLoc);
      }

      this.config = Object.assign({}, config, this.config);
    }
  }

  getScope(packageName: string): string {
    return !packageName || packageName[0] !== '@' ? '' : packageName.split(/\/|%2f/)[0];
  }

  getRegistry(packageName: string): string {
    // Try extracting registry from the url, then scoped registry, and default registry
    if (packageName.match(/^https?:/)) {
      const availableRegistries = this.getAvailableRegistries();
      const registry = availableRegistries.find((registry) => packageName.startsWith(registry));
      if (registry) {
        return registry;
      }
    }

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
      let auth = this.getScopedOption(registry.replace(/\/?$/, '/'), '_authToken');
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
