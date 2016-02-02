/* @flow */

import * as fs from "../util/fs";

let path = require("path");

export default class Registry {
  constructor(cwd: string) {
    this.config = {};
    this.folder = "";
    this.loc    = "";
    this.cwd    = cwd;
  }

  // whether to always flatten the graph for this registry, will cause manual conflict resolution
  static alwaysFlatten = false;

  // the filename to use for package metadata
  static filename: string;

  //
  cwd: string;

  //
  config: Object;

  //
  loc: string;

  //
  folder: string;

  async loadConfig(): Promise<void> {}

  async init(): Promise<void> {
    await this.loadConfig();

    // find in upper directories
    let loc = await fs.find(this.folder, this.cwd);

    // default to folder
    loc = loc || path.join(this.cwd, this.folder);

    // set output directory
    this.loc = loc;
  }
}
