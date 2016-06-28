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

import * as fs from "../util/fs.js";
import Registry from "./_base.js";

let userHome = require("user-home");
let path     = require("path");
let _        = require("lodash");
let ini      = require("ini");

function getGlobalPrefix(): string {
  if (process.env.PREFIX) {
    return process.env.PREFIX;
  } else if (process.platform === "win32") {
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
  static filenames = ["fbkpm.json", "package.json"];

  async loadConfig(): Promise<void> {
    // docs: https://docs.npmjs.com/misc/config
    this.folder = "node_modules";

    let possibles = [
      path.join(getGlobalPrefix(), ".npmrc"),
      path.join(userHome, ".npmrc"),
      path.join(this.cwd, ".npmrc"),
    ];
    let foldersFromRootToCwd = this.cwd.split(path.sep);
    while (foldersFromRootToCwd.length > 1) {
      possibles.push(path.join(foldersFromRootToCwd.join(path.sep), ".npmrc"));
      foldersFromRootToCwd.pop();
    }

    this.mergeEnv("npm_config_");

    for (let loc of possibles) {
      if (!(await fs.exists(loc))) continue;

      let config = ini.parse(await fs.readFile(loc));

      // normalise kpm offline mirror path relative to the current npmrc
      let offlineLoc = config["kpm-offline-mirror"];
      if (!this.config["kpm-offline-mirror"] && offlineLoc) {
        let mirrorLoc = config["kpm-offline-mirror"] = path.resolve(path.dirname(loc), offlineLoc);
        await fs.mkdirp(mirrorLoc);
      }

      _.defaults(this.config, config);
    }

    _.defaults(this.config, {
      registry: "http://registry.npmjs.org"
    });
  }
}
