'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shouldUpdateLockfile = undefined;

var _semver;

function _load_semver() {
  return _semver = _interopRequireDefault(require('semver'));
}

var _minimatch;

function _load_minimatch() {
  return _minimatch = _interopRequireDefault(require('minimatch'));
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('./util/map'));
}

var _normalizePattern2;

function _load_normalizePattern() {
  return _normalizePattern2 = require('./util/normalize-pattern.js');
}

var _parsePackagePath;

function _load_parsePackagePath() {
  return _parsePackagePath = _interopRequireDefault(require('./util/parse-package-path'));
}

var _parsePackagePath2;

function _load_parsePackagePath2() {
  return _parsePackagePath2 = require('./util/parse-package-path');
}

var _resolvers;

function _load_resolvers() {
  return _resolvers = require('./resolvers');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DIRECTORY_SEPARATOR = '/';
const GLOBAL_NESTED_DEP_PATTERN = '**/';

class ResolutionMap {
  constructor(config) {
    this.resolutionsByPackage = (0, (_map || _load_map()).default)();
    this.config = config;
    this.reporter = config.reporter;
    this.delayQueue = new Set();
  }

  init(resolutions = {}) {
    for (const globPattern in resolutions) {
      const info = this.parsePatternInfo(globPattern, resolutions[globPattern]);

      if (info) {
        const resolution = this.resolutionsByPackage[info.name] || [];
        this.resolutionsByPackage[info.name] = [...resolution, info];
      }
    }
  }

  addToDelayQueue(req) {
    this.delayQueue.add(req);
  }

  parsePatternInfo(globPattern, range) {
    if (!(0, (_parsePackagePath2 || _load_parsePackagePath2()).isValidPackagePath)(globPattern)) {
      this.reporter.warn(this.reporter.lang('invalidResolutionName', globPattern));
      return null;
    }

    const directories = (0, (_parsePackagePath || _load_parsePackagePath()).default)(globPattern);
    const name = directories.pop();

    if (!(_semver || _load_semver()).default.validRange(range) && !(0, (_resolvers || _load_resolvers()).getExoticResolver)(range)) {
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
      pattern: `${name}@${range}`
    };
  }

  find(reqPattern, parentNames) {
    var _normalizePattern = (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(reqPattern);

    const name = _normalizePattern.name,
          reqRange = _normalizePattern.range;

    const resolutions = this.resolutionsByPackage[name];

    if (!resolutions) {
      return '';
    }

    const modulePath = [...parentNames, name].join(DIRECTORY_SEPARATOR);

    var _ref = resolutions.find(({ globPattern }) => (0, (_minimatch || _load_minimatch()).default)(modulePath, globPattern)) || {};

    const pattern = _ref.pattern,
          range = _ref.range;


    if (pattern) {
      if ((_semver || _load_semver()).default.validRange(reqRange) && (_semver || _load_semver()).default.valid(range) && !(_semver || _load_semver()).default.satisfies(range, reqRange)) {
        this.reporter.warn(this.reporter.lang('incompatibleResolutionVersion', pattern, reqPattern));
      }
    }

    return pattern;
  }
}

exports.default = ResolutionMap;
const shouldUpdateLockfile = exports.shouldUpdateLockfile = (lockfileEntry, resolutionEntry) => {
  if (!lockfileEntry || !resolutionEntry) {
    return false;
  }

  return lockfileEntry.resolved !== resolutionEntry.remote.resolved;
};