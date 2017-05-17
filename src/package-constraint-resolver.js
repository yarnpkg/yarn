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

  reduce(versions: Array<string>, range: string): Promise<?string> {
    if (range === 'latest') {
      // Usually versions are already ordered and the last one is the latest
      return Promise.resolve(versions[versions.length - 1]);
    } else {
      return Promise.resolve(semver.maxSatisfying(versions, range, this.config.looseSemver));
    }
  }
}
