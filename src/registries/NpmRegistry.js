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

import * as fs from '../util/fs.js';
import Registry from './Registry.js';

const userHome = require('user-home');
const path = require('path');
const _ = require('lodash');
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
  static filenames = ['package.json'];
  static directory = 'node_modules';

  async loadConfig(): Promise<void> {
    // docs: https://docs.npmjs.com/misc/config
    this.folder = 'node_modules';

    const possibles = [
      path.join(getGlobalPrefix(), '.npmrc'),
      path.join(userHome, '.npmrc'),
      path.join(this.cwd, '.npmrc'),
    ];
    const foldersFromRootToCwd = this.cwd.split(path.sep);
    while (foldersFromRootToCwd.length > 1) {
      possibles.push(path.join(foldersFromRootToCwd.join(path.sep), '.npmrc'));
      foldersFromRootToCwd.pop();
    }

    this.mergeEnv('npm_config_');

    for (const loc of possibles) {
      if (!(await fs.exists(loc))) {
        continue;
      }

      const config = ini.parse(await fs.readFile(loc));

      // normalise kpm offline mirror path relative to the current npmrc
      const offlineLoc = config['kpm-offline-mirror'];
      if (!this.config['kpm-offline-mirror'] && offlineLoc) {
        const mirrorLoc = config['kpm-offline-mirror'] = path.resolve(path.dirname(loc), offlineLoc);
        await fs.mkdirp(mirrorLoc);
      }

      _.defaults(this.config, config);
    }

    _.defaults(this.config, {
      registry: 'http://registry.npmjs.org',
    });
  }
}
