/* @flow */

import type RequestManager from '../util/request-manager.js';
import NpmRegistry from './npm-registry.js';
import stringify from '../lockfile/stringify.js';
import parse from '../lockfile/parse.js';
import * as fs from '../util/fs.js';

const userHome = require('user-home');
const path = require('path');
const _ = require('lodash');

export default class YarnRegistry extends NpmRegistry {
  constructor(cwd: string, requestManager: RequestManager) {
    super(cwd, requestManager);

    this.homeConfigLoc = path.join(userHome, '.yarnrc');
    this.homeConfig = {};
  }

  static filename = 'yarn.json';

  homeConfigLoc: string;
  homeConfig: Object;

  async loadConfig(): Promise<void> {
    for (const [isHome,, file] of await this.getPossibleConfigLocations('.yarnrc')) {
      const config = parse(file);

      if (isHome) {
        this.homeConfig = config;
      }

      _.defaults(this.config, config);
    }
  }

  async saveHomeConfig(config: Object): Promise<void> {
    for (let key in config) {
      let val = config[key];

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
