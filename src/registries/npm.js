/* @flow */

import Registry from "./_base";

export default class NpmRegistry extends Registry {
  static filename = "package.json";

  async loadConfig(): Promise<void> {
    this.folder = "node_modules";
  }
}
