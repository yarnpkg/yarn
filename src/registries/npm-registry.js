/* @flow */

import type Reporter from '../reporters/base-reporter.js';
import type RequestManager from '../util/request-manager.js';
import type {RegistryRequestOptions, CheckOutdatedReturn} from './base-registry.js';
import type Config from '../config.js';
import type {ConfigRegistries} from './index.js';
import {YARN_REGISTRY} from '../constants.js';
import * as fs from '../util/fs.js';
import NpmResolver from '../resolvers/registries/npm-resolver.js';
import envReplace from '../util/env-replace.js';
import Registry from './base-registry.js';
import {addSuffix} from '../util/misc';
import {getPosixPath, resolveWithHome} from '../util/path';
import normalizeUrl from 'normalize-url';
import {default as userHome, home} from '../util/user-home-dir';
import path from 'path';
import url from 'url';
import ini from 'ini';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
const REGEX_REGISTRY_PREFIX = /^https?:/;
const REGEX_REGISTRY_SUFFIX = /registry\/?$/;

export const SCOPE_SEPARATOR = '%2f';
// All scoped package names are of the format `@scope%2fpkg` from the use of NpmRegistry.escapeName
// `(?:^|\/)` Match either the start of the string or a `/` but don't capture
// `[^\/?]+?` Match any character that is not '/' or '?' and capture, up until the first occurance of:
// `%2f` Match SCOPE_SEPARATOR, the escaped '/', and don't capture
const SCOPED_PKG_REGEXP = /(?:^|\/)(@[^\/?]+?)(?=%2f)/;

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

const PATH_CONFIG_OPTIONS = ['cache', 'cafile', 'prefix', 'userconfig'];

function isPathConfigOption(key: string): boolean {
  return PATH_CONFIG_OPTIONS.indexOf(key) >= 0;
}

function normalizePath(val: mixed): ?string {
  if (val === undefined) {
    return undefined;
  }

  if (typeof val !== 'string') {
    val = '' + (val: any);
  }

  return resolveWithHome(val);
}

export default class NpmRegistry extends Registry {
  constructor(cwd: string, registries: ConfigRegistries, requestManager: RequestManager, reporter: Reporter) {
    super(cwd, registries, requestManager, reporter);
    this.folder = 'node_modules';
  }

  static filename = 'package.json';

  static escapeName(name: string): string {
    // scoped packages contain slashes and the npm registry expects them to be escaped
    return name.replace('/', SCOPE_SEPARATOR);
  }

  isScopedPackage(packageIdent: string): boolean {
    return SCOPED_PKG_REGEXP.test(packageIdent);
  }

  getRequestUrl(registry: string, pathname: string): string {
    const isUrl = /^https?:/.test(pathname);

    if (isUrl) {
      return pathname;
    } else {
      return url.resolve(registry, pathname);
    }
  }

  isRequestToRegistry(requestUrl: string, registryUrl: string): boolean {
    const normalizedRequestUrl = normalizeUrl(requestUrl);
    const normalizedRegistryUrl = normalizeUrl(registryUrl);
    const requestParsed = url.parse(normalizedRequestUrl);
    const registryParsed = url.parse(normalizedRegistryUrl);
    const requestHost = requestParsed.host || '';
    const registryHost = registryParsed.host || '';
    const requestPath = requestParsed.path || '';
    const registryPath = registryParsed.path || '';
    const customHostSuffix = this.getRegistryOrGlobalOption(registryUrl, 'custom-host-suffix');

    return (
      requestHost === registryHost &&
      (requestPath.startsWith(registryPath) ||
        // For some registries, the package path does not prefix with the registry path
        (typeof customHostSuffix === 'string' && requestHost.endsWith(customHostSuffix)))
    );
  }

  request(pathname: string, opts?: RegistryRequestOptions = {}, packageName: ?string): Promise<*> {
    // packageName needs to be escaped when if it is passed
    const packageIdent = (packageName && NpmRegistry.escapeName(packageName)) || pathname;
    const registry = this.getRegistry(packageIdent);
    const requestUrl = this.getRequestUrl(registry, pathname);

    const alwaysAuth = this.getRegistryOrGlobalOption(registry, 'always-auth');

    const headers = Object.assign(
      {
        Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
      },
      opts.headers,
    );

    const isToRegistry = this.isRequestToRegistry(requestUrl, registry);

    // this.token must be checked to account for publish requests on non-scopped packages
    if (this.token || (isToRegistry && (alwaysAuth || this.isScopedPackage(packageIdent)))) {
      const authorization = this.getAuth(packageIdent);
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
    const req = await this.request(NpmRegistry.escapeName(name), {
      headers: {Accept: 'application/json'},
    });
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

  async getPossibleConfigLocations(filename: string, reporter: Reporter): Promise<Array<[boolean, string, string]>> {
    // npmrc --> ./.npmrc, ~/.npmrc, ${prefix}/etc/npmrc
    const localfile = '.' + filename;
    const possibles = [
      [false, path.join(this.cwd, localfile)],
      [true, this.config.userconfig || path.join(userHome, localfile)],
      [false, path.join(getGlobalPrefix(), 'etc', filename)],
    ];

    // When home directory for global install is different from where $HOME/npmrc is stored,
    // E.g. /usr/local/share vs /root on linux machines, check the additional location
    if (home !== userHome) {
      possibles.push([true, path.join(home, localfile)]);
    }

    // npmrc --> ../.npmrc, ../../.npmrc, etc.
    const foldersFromRootToCwd = getPosixPath(this.cwd).split('/');
    while (foldersFromRootToCwd.length > 1) {
      possibles.push([false, path.join(foldersFromRootToCwd.join(path.sep), localfile)]);
      foldersFromRootToCwd.pop();
    }

    const actuals = [];
    for (const [isHome, loc] of possibles) {
      reporter.verbose(reporter.lang('configPossibleFile', loc));
      if (await fs.exists(loc)) {
        reporter.verbose(reporter.lang('configFileFound', loc));
        actuals.push([isHome, loc, await fs.readFile(loc)]);
      }
    }
    return actuals;
  }

  static normalizeConfig(config: Object): Object {
    config = Registry.normalizeConfig(config);

    for (const key: string in config) {
      config[key] = envReplace(config[key]);
      if (isPathConfigOption(key)) {
        config[key] = normalizePath(config[key]);
      }
    }

    return config;
  }

  async loadConfig(): Promise<void> {
    // docs: https://docs.npmjs.com/misc/config
    this.mergeEnv('npm_config_');

    for (const [, loc, file] of await this.getPossibleConfigLocations('npmrc', this.reporter)) {
      const config = NpmRegistry.normalizeConfig(ini.parse(file));

      // normalize offline mirror path relative to the current npmrc
      const offlineLoc = config['yarn-offline-mirror'];
      // don't normalize if we already have a mirror path
      if (!this.config['yarn-offline-mirror'] && offlineLoc) {
        const mirrorLoc = (config['yarn-offline-mirror'] = path.resolve(path.dirname(loc), offlineLoc));
        await fs.mkdirp(mirrorLoc);
      }

      this.config = Object.assign({}, config, this.config);
    }
  }

  getScope(packageIdent: string): string {
    const match = packageIdent.match(SCOPED_PKG_REGEXP);
    return (match && match[1]) || '';
  }

  getRegistry(packageIdent: string): string {
    // Try extracting registry from the url, then scoped registry, and default registry
    if (packageIdent.match(/^https?:/)) {
      const availableRegistries = this.getAvailableRegistries();
      const registry = availableRegistries.find(registry => packageIdent.startsWith(registry));
      if (registry) {
        return String(registry);
      }
    }

    for (const scope of [this.getScope(packageIdent), '']) {
      const registry =
        this.getScopedOption(scope, 'registry') || this.registries.yarn.getScopedOption(scope, 'registry');
      if (registry) {
        return String(registry);
      }
    }

    return DEFAULT_REGISTRY;
  }

  getAuth(packageIdent: string): string {
    if (this.token) {
      return this.token;
    }

    const baseRegistry = this.getRegistry(packageIdent);
    const registries = [baseRegistry];

    // If sending a request to the Yarn registry, we must also send it the auth token for the npm registry
    if (baseRegistry === YARN_REGISTRY) {
      registries.push(DEFAULT_REGISTRY);
    }

    for (const registry of registries) {
      // Check for bearer token.
      const authToken = this.getRegistryOrGlobalOption(registry, '_authToken');
      if (authToken) {
        return `Bearer ${String(authToken)}`;
      }

      // Check for basic auth token.
      const auth = this.getRegistryOrGlobalOption(registry, '_auth');
      if (auth) {
        return `Basic ${String(auth)}`;
      }

      // Check for basic username/password auth.
      const username = this.getRegistryOrGlobalOption(registry, 'username');
      const password = this.getRegistryOrGlobalOption(registry, '_password');
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

  getRegistryOption(registry: string, option: string): mixed {
    const pre = REGEX_REGISTRY_PREFIX;
    const suf = REGEX_REGISTRY_SUFFIX;

    // When registry is used config scope, the trailing '/' is required
    const reg = addSuffix(registry, '/');

    // 1st attempt, try to get option for the given registry URL
    // 2nd attempt, remove the 'https?:' prefix of the registry URL
    // 3nd attempt, remove the 'registry/?' suffix of the registry URL
    return (
      this.getScopedOption(reg, option) ||
      (reg.match(pre) && this.getRegistryOption(reg.replace(pre, ''), option)) ||
      (reg.match(suf) && this.getRegistryOption(reg.replace(suf, ''), option))
    );
  }

  getRegistryOrGlobalOption(registry: string, option: string): mixed {
    return this.getRegistryOption(registry, option) || this.getOption(option);
  }
}
