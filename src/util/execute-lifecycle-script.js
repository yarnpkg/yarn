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

import type Config from '../config';
import * as constants from '../constants.js';
import * as child from './child.js';
import {registries} from '../resolvers/index.js';
import type {Reporter} from '../reporters/index.js';

const path = require('path');

export default async function (config: Config, cwd: string, cmds: Array<string>, reporter?: Reporter): Promise<Array<{
  cwd: string,
  command: string,
  stdout: string,
}>> {
  const results = [];

  for (const cmd of cmds) {
    const env = Object.assign({}, process.env);

    // this is used in some places apparently..
    env.npm_execpath = path.join(__dirname, '..', '..', 'bin', 'kpm.js');

    // split up the path
    const pathParts = (env[constants.ENV_PATH_KEY] || '').split(path.delimiter);

    // add node-gyp
    pathParts.unshift(path.join(__dirname, '..', '..', 'bin', 'node-gyp-bin'));

    // add .bin folders to PATH
    for (const registry of Object.keys(registries)) {
      pathParts.unshift(path.join(cwd, config.registries[registry].folder, '.bin'));
    }

    // join path back together
    env[constants.ENV_PATH_KEY] = pathParts.join(path.delimiter);

    let spinner;
    if (reporter) {
      spinner = reporter.activity();
    }

    let stdout = await child.spawn('sh', ['-c', cmd], {cwd, env}, (data) => {
      if (spinner) {
        spinner.tick(data.toString().trim().split('\n')[0]);
      }
    });

    if (spinner) {
      spinner.end();
    }

    results.push({cwd, command: cmd, stdout});
  }

  return results;
}
