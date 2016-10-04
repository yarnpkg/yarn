/* @flow */

import type RequestManager from '../util/request-manager.js';
import type {RegistryRequestOptions} from './base-registry.js';
import * as fs from '../util/fs.js';
import Registry from './base-registry.js';
import {removeSuffix} from '../util/misc.js';

const defaults = require('defaults');
const userHome = require('user-home');
const path = require('path');
const url = require('url');
const ini = require('ini');

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
  constructor(cwd: string, requestManager: RequestManager) {
    super(cwd, requestManager);
    this.folder = 'node_modules';
  }

  static filename = 'package.json';

  static escapeName(name: string): string {
    // scoped packages contain slashes and the npm registry expects them to be escaped
    return name.replace('/', '%2f');
  }

  request(pathname: string, opts?: RegistryRequestOptions = {}): Promise<?Object> {
    const registry = removeSuffix(this.config.registry, '/');

    let headers = {};
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    return this.requestManager.request({
      url: url.resolve(registry, pathname),
      method: opts.method,
      body: opts.body,
      headers,
      json: true,
    });
  }

  async getPossibleConfigLocations(filename: string): Promise<Array<[boolean, string, string]>> {
    const possibles = [
      [false, path.join(getGlobalPrefix(), filename)],
      [true, path.join(userHome, filename)],
      [false, path.join(this.cwd, filename)],
    ];

    const foldersFromRootToCwd = this.cwd.split(path.sep);
    while (foldersFromRootToCwd.length > 1) {
      possibles.push([false, path.join(foldersFromRootToCwd.join(path.sep), filename)]);
      foldersFromRootToCwd.pop();
    }

    let actuals = [];
    for (let [isHome, loc] of possibles) {
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

      // normalize kpm offline mirror path relative to the current npmrc
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

    defaults(this.config, {
      registry: 'http://registry.npmjs.org',
    });
  }
}
