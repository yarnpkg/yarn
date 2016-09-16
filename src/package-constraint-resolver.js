/* @flow */

import type {Reporter} from './reporters/index.js';
import type Config from './config.js';

const semver = require('semver');

// This isn't really a "proper" constraint resolver. We just return the highest semver
// version in the versions passed that satisfies the input range. This vastly reduces
// the complexity and is very efficient for package resolution.

export default class PackageConstraintResolver {
  constructor(config: Config, reporter: Reporter) {
    this.reporter = reporter;
    this.config = config;
  }

  reporter: Reporter;
  config: Config;

  async reduce(versions: Array<string>, range: string): Promise<?string> {
    return semver.maxSatisfying(versions, range);
  }
}
