/* @flow */

import Registry from './base-registry.js';
import * as fs from '../util/fs.js';

const defaults = require('defaults');
const userHome = require('user-home');
const path = require('path');

export default class BowerRegistry extends Registry {
  static filename = 'bower.json';

  async loadConfig(): Promise<void> {
    // docs: http://bower.io/docs/config/
    // spec: https://github.com/bower/spec/blob/master/config.md

    this.mergeEnv('bower_');

    // merge in configs
    const possibles = [
      path.join('/', '.bowerrc'),
      path.join(userHome, '.bowerrc'),
      // TODO all .bowerrc files upwards the directory tree
      path.join(this.cwd, '.bowerrc'),
    ];
    for (const loc of possibles) {
      if (await fs.exists(loc)) {
        Object.assign(this.config, await fs.readJson(loc));
      }
    }

    defaults(this.config, {
      registry: 'https://bower.herokuapp.com',
      directory: 'bower_components',
    });

    // TODO: warn on properties we do not support

    this.folder = this.config.directory;
  }
}
