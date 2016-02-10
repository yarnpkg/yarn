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

import * as constants from "../constants.js";
import * as child from "./child.js";
import { registries } from "../resolvers/index.js";
import type Config from "../config";

let path = require("path");

export default async function (config: Config, cwd: string, cmds: Array<string>): Promise<Array<{
  cwd: string,
  command: string,
  stdout: string,
  stderr: string
}>> {
  let results = [];

  for (let cmd of cmds) {
    let env = Object.assign({}, process.env);

    // this is used in some places apparently..
    env.npm_execpath = path.join(__dirname, "..", "..", "bin", "kpm.js");

    // split up the path
    let pathParts = (env[constants.ENV_PATH_KEY] || "").split(path.delimiter);

    // add node-gyp
    pathParts.unshift(path.join(__dirname, "..", "..", "bin", "node-gyp-bin"));

    // add node_modules .bin
    for (let registry of Object.keys(registries)) {
      pathParts.unshift(path.join(cwd, config.registries[registry].folder, ".bin"));
    }

    // join path back together
    env[constants.ENV_PATH_KEY] = pathParts.join(path.delimiter);

    let [stdout, stderr] = await child.exec(cmd, { cwd, env });
    results.push({ cwd, command: cmd, stdout, stderr });
  }

  return results;
}
