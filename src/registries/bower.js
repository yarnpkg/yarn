/* @flow */

import Registry from "./_base";
import * as fs from "../util/fs";

let path = require("path");
let os   = require("os");
let _    = require("lodash");

export default class BowerRegistry extends Registry {
  static alwaysFlatten = true;
  static filename = "bower.json";

  async loadConfig(): Promise<void> {
    // docs: http://bower.io/docs/config/
    // spec: https://github.com/bower/spec/blob/master/config.md

    this.mergeEnv("bower_");

    // merge in configs
    let possibles = [
      path.join("/", ".bowerrc"),
      path.join(os.homedir(), ".bowerrc"),
      // TODO all .bowerrc files upwards the directory tree
      path.join(this.cwd, ".bowerrc"),
    ];
    for (let loc of possibles) {
      if (await fs.exists(loc)) {
        Object.assign(this.config, await fs.readJson(loc));
      }
    }

    _.defaults(this.config, {
      registry: "https://bower.herokuapp.com",
      directory: "bower_components"
    });

    // TODO: warn on properties we do not support

    this.folder = this.config.directory;
  }
}
