/* @flow */

import Registry from "./_base";
import * as fs from "../util/fs";

export default class BowerRegistry extends Registry {
  static alwaysFlatten = true;
  static filename = "bower.json";

  async loadConfig(): Promise<void> {
    // docs: http://bower.io/docs/config/

    // find .bowerrc in parent directories
    let config;
    let loc = await fs.find(".bowerrc", this.cwd);
    if (loc) {
      config = await fs.readJson(loc);
    } else {
      config = {};
    }

    config = Object.assign({
      registry: "https://bower.herokuapp.com",
      directory: "bower_components"
    }, config);

    this.config = config;
    this.folder = config.directory;
  }
}
