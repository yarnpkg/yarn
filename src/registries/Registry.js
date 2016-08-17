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

import {removePrefix} from '../util/misc.js';
import * as fs from '../util/fs.js';

const path = require('path');
const _ = require('lodash');

export default class Registry {
  constructor(cwd: string) {
    this.config = {};
    this.folder = '';
    this.loc    = '';
    this.cwd    = cwd;
  }

  // whether to always flatten the graph for this registry, will cause manual conflict resolution
  static alwaysFlatten = false;

  // the filename to use for package metadata
  static filenames: Array<string>;

  //
  cwd: string;

  //
  config: Object;

  // absolute folder name to insert modules
  loc: string;

  // relative folder name to put these modules
  folder: string;

  async loadConfig(): Promise<void> {}

  async init(): Promise<void> {
    this.mergeEnv('kpm_');
    this.mergeEnv('fbkpm_');
    await this.loadConfig();

    // find in upper directories
    let loc = await fs.find(this.folder, this.cwd);

    // default to folder
    loc = loc || path.join(this.cwd, this.folder);

    // set output directory
    this.loc = loc;
  }

  mergeEnv(prefix: string) {
    // try environment variables
    for (let key in process.env) {
      key = key.toLowerCase();

      // only accept keys prefixed with the prefix
      if (key.indexOf(prefix) < 0) {
        continue;
      }

      const val = process.env[key];

      // remove bower prefix
      key = removePrefix(key, prefix);

      // replace dunders with dots
      key = key.replace(/__/g, '.');

      // replace underscores with dashes
      key = key.replace(/_/g, '-');

      // set it via a path
      _.set(this.config, key, val);
    }
  }
}
