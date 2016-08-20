/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import NpmRegistry from './NpmRegistry.js';
import stringify from '../lockfile/stringify.js';
import parse from '../lockfile/parse.js';
import * as fs from '../util/fs.js';

const userHome = require('user-home');
const path = require('path');
const _ = require('lodash');

export default class KpmRegistry extends NpmRegistry {
  constructor(cwd: string) {
    super(cwd);

    this.homeConfigLoc = path.join(userHome, '.kpmrc');
    this.homeConfig = {};
  }

  homeConfigLoc: string;
  homeConfig: Object;

  async loadConfig(): Promise<void> {
    for (const [isHome,, file] of await this.getPossibleConfigLocations('.kpmrc')) {
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
