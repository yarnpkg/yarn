/* @flow */

import type Reporter from "./reporters/_base.js";
import type Config from "./config.js";

let semver = require("semver");

// This isn't really a "proper" constraint resolver. We just return the highest semver
// version in the versions passed that satisfies the input range. This vastily reduces
// the complexity and is very efficient for package resolution.

export default class PackageConstraintResolver {
  constructor(config: Config, reporter: Reporter) {
    this.reporter = reporter;
    this.config   = config;
  }

  reporter: Reporter;
  config: Config;

  async reduce(versions: Array<string>, range: string): Promise<string> {
    return semver.maxSatisfying(versions, range);
  }
}
