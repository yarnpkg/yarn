/* @flow */

import * as fs from "../util/fs.js";
import Registry from "./_base.js";

let path = require("path");
let os   = require("os");
let _    = require("lodash");

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
  static filename = "package.json";

  async loadConfig(): Promise<void> {
    // docs: https://docs.npmjs.com/misc/config
    this.folder = "node_modules";

    let possibles = [
      path.join(getGlobalPrefix(), ".npmrc"),
      path.join(os.homedir(), ".npmrc"),
      path.join(this.cwd, ".npmrc"),
    ];

    this.mergeEnv("npm_config_");

    for (let loc of possibles) {
      if (await fs.exists(loc)) {
        // TODO: merge it in!
      }
    }

    _.defaults(this.config, {
      registry: "http://registry.npmjs.org"
    });
  }
}
