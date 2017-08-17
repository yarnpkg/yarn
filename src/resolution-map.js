/* @flow */
import semver from 'semver';
import minimatch from 'minimatch';
import map from './util/map';
import type Config from './config';
import type {Reporter} from './reporters';
import PackageRequest from './package-request';
import {getExoticResolver} from './resolvers';

const DIRECTORY_SEPARATOR = '/';
const GLOBAL_NESTED_DEP_PATTERN = '**/';

export type Resolution = {
  name: string,
  range: string,
  pattern: string,
  globPattern: string,
};

export type ResolutionInternalMap = {
  [packageName: string]: Array<Resolution>,
};

export type ResolutionEntry = {
  [packageName: string]: string,
};

export default class ResolutionMap {
  constructor(config: Config) {
    this.resolutionsByPackage = map();
    this.config = config;
    this.reporter = config.reporter;
  }

  resolutionsByPackage: ResolutionInternalMap;
  config: Config;
  reporter: Reporter;

  init(resolutions: ?ResolutionEntry = {}) {
    for (const globPattern in resolutions) {
      const info = this.parsePatternInfo(globPattern, resolutions[globPattern]);

      if (info) {
        const resolution = this.resolutionsByPackage[info.name] || [];
        this.resolutionsByPackage[info.name] = [...resolution, info];
      }
    }
  }

  parsePatternInfo(globPattern: string, range: string): ?Object {
    const directories = globPattern.split(DIRECTORY_SEPARATOR);
    const name = directories.pop();

    if (!name) {
      this.reporter.warn(this.reporter.lang('invalidResolutionName', globPattern));
      return null;
    }

    if (!semver.validRange(range) && !getExoticResolver(range)) {
      this.reporter.warn(this.reporter.lang('invalidResolutionVersion', range));
      return null;
    }

    // For legacy support of resolutions, replace `name` with `**/name`
    if (name === globPattern) {
      globPattern = `${GLOBAL_NESTED_DEP_PATTERN}${name}`;
    }

    return {
      name,
      range,
      globPattern,
      pattern: `${name}@${range}`,
    };
  }

  find(reqPattern: string, parentNames: Array<string>): ?string {
    const {name, range: reqRange} = PackageRequest.normalizePattern(reqPattern);
    const resolutions = this.resolutionsByPackage[name];

    if (!resolutions) {
      return '';
    }

    const modulePath = [...parentNames, name].join(DIRECTORY_SEPARATOR);
    const {pattern, range} = resolutions.find(({globPattern}) => minimatch(modulePath, globPattern)) || {};

    if (pattern) {
      if (semver.validRange(reqRange) && semver.valid(range) && !semver.satisfies(range, reqRange)) {
        this.reporter.warn(this.reporter.lang('incompatibleResolutionVersion', pattern, reqPattern));
      }
    }

    return pattern;
  }
}
