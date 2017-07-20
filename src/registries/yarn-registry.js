/* @flow */

import type Reporter from '../reporters/base-reporter.js';
import type RequestManager from '../util/request-manager.js';
import type {ConfigRegistries} from './index.js';
import {YARN_REGISTRY} from '../constants.js';
import NpmRegistry from './npm-registry.js';
import stringify from '../lockfile/stringify.js';
import parse from '../lockfile/parse.js';
import * as fs from '../util/fs.js';
import {version} from '../util/yarn-version.js';

const userHome = require('../util/user-home-dir').default;
const path = require('path');

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
  'user-agent': [`yarn/${version}`, 'npm/?', `node/${process.version}`, process.platform, process.arch].join(' '),
};

const npmMap = {
  'version-git-sign': 'sign-git-tag',
  'version-tag-prefix': 'tag-version-prefix',
  'version-git-tag': 'git-tag-version',
  'version-git-message': 'message',
};

export default class YarnRegistry extends NpmRegistry {
  constructor(cwd: string, registries: ConfigRegistries, requestManager: RequestManager, reporter: Reporter) {
    super(cwd, registries, requestManager, reporter);

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
    for (const [isHome, loc, file] of await this.getPossibleConfigLocations('yarnrc', this.reporter)) {
      const {object: config} = parse(file, loc);

      if (isHome) {
        this.homeConfig = config;
      }

      // normalize offline mirror path relative to the current yarnrc
      const offlineLoc = config['yarn-offline-mirror'];

      // don't normalize if we already have a mirror path
      if (!this.config['yarn-offline-mirror'] && offlineLoc) {
        const mirrorLoc = (config['yarn-offline-mirror'] = path.resolve(path.dirname(loc), offlineLoc));
        await fs.mkdirp(mirrorLoc);
      }

      // merge with any existing environment variables
      const env = config.env;
      if (env) {
        const existingEnv = this.config.env;
        if (existingEnv) {
          this.config.env = Object.assign({}, env, existingEnv);
        }
      }

      this.config = Object.assign({}, config, this.config);
    }

    // default yarn config
    this.config = Object.assign({}, DEFAULTS, this.config);
  }

  async saveHomeConfig(config: Object): Promise<void> {
    YarnRegistry.normalizeConfig(config);

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

    await fs.writeFilePreservingEol(this.homeConfigLoc, `${stringify(this.homeConfig)}\n`);
  }
}
