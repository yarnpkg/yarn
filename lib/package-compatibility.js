'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.testEngine = testEngine;
exports.checkOne = checkOne;
exports.check = check;
exports.shouldCheck = shouldCheck;

var _errors;

function _load_errors() {
  return _errors = require('./errors.js');
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('./util/map.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('./util/misc.js');
}

var _yarnVersion;

function _load_yarnVersion() {
  return _yarnVersion = require('./util/yarn-version.js');
}

var _semver;

function _load_semver() {
  return _semver = require('./util/semver.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const semver = require('semver');

const VERSIONS = Object.assign({}, process.versions, {
  yarn: (_yarnVersion || _load_yarnVersion()).version
});

function isValid(items, actual) {
  let isNotWhitelist = true;
  let isBlacklist = false;

  for (var _iterator = items, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    const item = _ref;

    // blacklist
    if (item[0] === '!') {
      isBlacklist = true;

      if (actual === item.slice(1)) {
        return false;
      }
      // whitelist
    } else {
      isNotWhitelist = false;

      if (item === actual) {
        return true;
      }
    }
  }

  // npm allows blacklists and whitelists to be mixed. Blacklists with
  // whitelisted items should be treated as whitelists.
  return isBlacklist && isNotWhitelist;
}

const aliases = (0, (_map || _load_map()).default)({
  iojs: 'node' // we should probably prompt these libraries to fix this
});

const ignore = ['npm', // we'll never satisfy this for obvious reasons
'teleport', // a module bundler used by some modules
'rhino', // once a target for older modules
'cordovaDependencies'];

function testEngine(name, range, versions, looseSemver) {
  const actual = versions[name];
  if (!actual) {
    return false;
  }

  if (!semver.valid(actual, looseSemver)) {
    return false;
  }

  if (semver.satisfies(actual, range, looseSemver)) {
    return true;
  }

  if (name === 'yarn' && (0, (_semver || _load_semver()).satisfiesWithPrereleases)(actual, range, looseSemver)) {
    return true;
  }

  if (name === 'node' && semver.gt(actual, '1.0.0', looseSemver)) {
    // WARNING: this is a massive hack and is super gross but necessary for compatibility
    // some modules have the `engines.node` field set to a caret version below semver major v1
    // eg. ^0.12.0. this is problematic as we enforce engines checks and node is now on version >=1
    // to allow this pattern we transform the node version to fake ones in the minor range 10-13
    const major = semver.major(actual, looseSemver);
    const fakes = [`0.10.${major}`, `0.11.${major}`, `0.12.${major}`, `0.13.${major}`];
    for (var _iterator2 = fakes, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref2 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref2 = _i2.value;
      }

      const actualFake = _ref2;

      if (semver.satisfies(actualFake, range, looseSemver)) {
        return true;
      }
    }
  }

  // incompatible version
  return false;
}

function isValidArch(archs) {
  return isValid(archs, process.arch);
}

function isValidPlatform(platforms) {
  return isValid(platforms, process.platform);
}

function checkOne(info, config, ignoreEngines) {
  let didIgnore = false;
  let didError = false;
  const reporter = config.reporter;
  const human = `${info.name}@${info.version}`;

  const pushError = msg => {
    const ref = info._reference;

    if (ref && ref.optional) {
      ref.ignore = true;
      ref.incompatible = true;

      reporter.info(`${human}: ${msg}`);
      if (!didIgnore) {
        reporter.info(reporter.lang('optionalCompatibilityExcluded', human));
        didIgnore = true;
      }
    } else {
      reporter.error(`${human}: ${msg}`);
      didError = true;
    }
  };

  const os = info.os,
        cpu = info.cpu,
        engines = info.engines;


  if (shouldCheckPlatform(os, config.ignorePlatform) && !isValidPlatform(os)) {
    pushError(reporter.lang('incompatibleOS', process.platform));
  }

  if (shouldCheckCpu(cpu, config.ignorePlatform) && !isValidArch(cpu)) {
    pushError(reporter.lang('incompatibleCPU', process.arch));
  }

  if (shouldCheckEngines(engines, ignoreEngines)) {
    for (var _iterator3 = (0, (_misc || _load_misc()).entries)(info.engines), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref3;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref3 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref3 = _i3.value;
      }

      const entry = _ref3;

      let name = entry[0];
      const range = entry[1];

      if (aliases[name]) {
        name = aliases[name];
      }

      if (VERSIONS[name]) {
        if (!testEngine(name, range, VERSIONS, config.looseSemver)) {
          pushError(reporter.lang('incompatibleEngine', name, range, VERSIONS[name]));
        }
      } else if (ignore.indexOf(name) < 0) {
        reporter.warn(`${human}: ${reporter.lang('invalidEngine', name)}`);
      }
    }
  }

  if (didError) {
    throw new (_errors || _load_errors()).MessageError(reporter.lang('foundIncompatible'));
  }
}

function check(infos, config, ignoreEngines) {
  for (var _iterator4 = infos, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
    var _ref4;

    if (_isArray4) {
      if (_i4 >= _iterator4.length) break;
      _ref4 = _iterator4[_i4++];
    } else {
      _i4 = _iterator4.next();
      if (_i4.done) break;
      _ref4 = _i4.value;
    }

    const info = _ref4;

    checkOne(info, config, ignoreEngines);
  }
}

function shouldCheckCpu(cpu, ignorePlatform) {
  return !ignorePlatform && Array.isArray(cpu) && cpu.length > 0;
}

function shouldCheckPlatform(os, ignorePlatform) {
  return !ignorePlatform && Array.isArray(os) && os.length > 0;
}

function shouldCheckEngines(engines, ignoreEngines) {
  return !ignoreEngines && typeof engines === 'object';
}

function shouldCheck(manifest, options) {
  return shouldCheckCpu(manifest.cpu, options.ignorePlatform) || shouldCheckPlatform(manifest.os, options.ignorePlatform) || shouldCheckEngines(manifest.engines, options.ignoreEngines);
}