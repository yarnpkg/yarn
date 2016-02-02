/* @flow */
/* eslint no-unused-vars: 0 */

import type { PackageInfo, PackageRemote } from "../types";
import type { RegistryNames } from "../registries";
import type Config from "../config";
import * as constants from "../constants";
import * as util from "../util/misc";
import * as fs from "../util/fs";

let path = require("path");

export default class BaseFetcher {
  constructor(remote: PackageRemote, config: Config) {
    this.reference = remote.reference;
    this.registry  = remote.registry;
    this.hash      = remote.hash;
    this.config    = config;
  }

  registry: RegistryNames;
  reference: any;
  config: Config;
  hash: ?string;

  async _fetch(dest: string): Promise<string> {
    throw new Error("Not implemented");
  }

  async fetch(dest: string): Promise<{
    hash: string;
    package: PackageInfo;
  }> {
    await fs.mkdirp(dest);

    try {
      let hash = await this._fetch(dest);
      let pkg = await fs.readPackageJson(dest, this.registry);

      await fs.writeFile(path.join(dest, constants.METADATA_FILENAME), JSON.stringify({
        registry: this.registry,
        hash
      }, null, "  "));

      return {
        hash,
        package: pkg
      };
    } catch (err) {
      await fs.unlink(dest);
      throw err;
    }
  }
}
