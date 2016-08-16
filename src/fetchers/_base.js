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
/* eslint no-unused-vars: 0 */

import type { Manifest, PackageRemote, FetchedManifest } from '../types.js';
import type { RegistryNames } from '../registries/index.js';
import type Config from '../config.js';
import * as constants from '../constants.js';
import * as util from '../util/misc.js';
import * as fs from '../util/fs.js';

let path = require('path');

export default class BaseFetcher {
  constructor(remote: PackageRemote, config: Config, saveForOffline?: boolean) {
    this.reference      = remote.reference;
    this.registry       = remote.registry;
    this.hash           = remote.hash;
    this.remote         = remote;
    this.config         = config;
    this.saveForOffline = !!saveForOffline;
  }

  remote: PackageRemote;
  registry: RegistryNames;
  reference: string;
  config: Config;
  hash: ?string;
  saveForOffline: boolean;

  async _fetch(dest: string): Promise<string> {
    throw new Error('Not implemented');
  }

  fetch(dest: string): Promise<FetchedManifest> {
    return fs.lockQueue.push(dest, async (): Promise<FetchedManifest> => {
      // fetch package and get the hash
      let hash = await this._fetch(dest);

      // load the new normalised package.json
      let pkg = await this.config.readManifest(dest, this.registry);

      await fs.writeFile(path.join(dest, constants.METADATA_FILENAME), JSON.stringify({
        remote: this.remote,
        registry: this.registry,
        hash,
      }, null, '  '));

      return {
        hash,
        dest,
        package: pkg,
      };
    });
  }
}
