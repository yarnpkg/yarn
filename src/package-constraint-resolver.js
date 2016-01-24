/* @flow */

import type Reporter from "./reporters/_base";
import type Config from "./config";

let semver = require("semver");

export default class PackageConstraintResolver {
  constructor(reporter: Reporter, config: Config) {
    this.reporter = reporter;
    this.config   = config;
  }

  reporter: Reporter;
  config: Config;

  async reduce(versions: Array<string>, range: string): Promise<string> {
    return semver.maxSatisfying(versions, range);
  }
}
