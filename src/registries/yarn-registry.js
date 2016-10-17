/* @flow */

import type RequestManager from '../util/request-manager.js';
import type {ConfigRegistries} from './index.js';
import {YARN_REGISTRY} from '../constants.js';
import NpmRegistry from './npm-registry.js';
import stringify from '../lockfile/stringify.js';
import parse from '../lockfile/parse.js';
import * as fs from '../util/fs.js';

const userHome = require('user-home');
const defaults = require('defaults');
const path = require('path');
const pkg: { version: string } = require('../../package.json');

export const DEFAULTS = {
  'version-tag-prefix': 'v',
  'version-git-tag': true,
  'version-git-sign': false,
  'version-git-message': 'v%s',

  'init-version': '1.0.0',
  'init-license': 'MIT',

  'save-prefix': '^',
  'ignore-scripts': false,
  'ignore-optional': false,
  registry: YARN_REGISTRY,
  'strict-ssl': true,
  'user-agent': [
    `yarn/${pkg.version}`,
    'npm/?',
    `node/${process.version}`,
    process.platform,
    process.arch,
  ].join(' '),
};

const npmMap = {
  'version-git-sign': 'sign-git-tag',
  'version-tag-prefix': 'tag-version-prefix',
  'version-git-tag': 'git-tag-version',
  'version-git-message': 'message',
};

export default class YarnRegistry extends NpmRegistry {
  constructor(cwd: string, registries: ConfigRegistries, requestManager: RequestManager) {
    super(cwd, registries, requestManager);

    this.homeConfigLoc = path.join(userHome, '.yarnrc');
    this.homeConfig = {};
  }

  static filename = 'yarn.json';

  homeConfigLoc: string;
  homeConfig: Object;

  getOption(key: string): mixed {
    let val = this.config[key];

    // if this isn't set in a yarn config, then use npm
    if (typeof val === 'undefined') {
      val = this.registries.npm.getOption(npmMap[key]);
    }

    if (typeof val === 'undefined') {
      val = this.registries.npm.getOption(key);
    }

    // if this isn't set in a yarn config or npm config, then use the default (or undefined)
    if (typeof val === 'undefined') {
      val = DEFAULTS[key];
    }
    
    return val;
  }

  async loadConfig(): Promise<void> {
    for (const [isHome,, file] of await this.getPossibleConfigLocations('.yarnrc')) {
      const config = parse(file);

      if (isHome) {
        this.homeConfig = config;
      }

      defaults(this.config, config);
    }

    // default yarn config
    defaults(this.config, DEFAULTS);
  }

  async saveHomeConfig(config: Object): Promise<void> {
    for (const key in config) {
      const val = config[key];

      // if the current config key was taken from home config then update
      // the global config
      if (this.homeConfig[key] === this.config[key]) {
        this.config[key] = val;
      }

      // update just the home config
      this.homeConfig[key] = config[key];
    }

    await fs.writeFile(this.homeConfigLoc, `${stringify(this.homeConfig)}\n`);
  }
}
