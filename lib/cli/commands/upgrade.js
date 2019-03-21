'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOutdated = exports.run = exports.requireLockfile = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    let addArgs = [];
    const upgradeAll = args.length === 0 && typeof flags.scope === 'undefined' && typeof flags.pattern === 'undefined';
    const addFlags = Object.assign({}, flags, {
      force: true,
      ignoreWorkspaceRootCheck: true,
      workspaceRootIsCwd: config.cwd === config.lockfileFolder
    });
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.lockfileFolder, reporter);
    const deps = yield getOutdated(config, reporter, flags, lockfile, args);
    const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);

    var _ref2 = yield install.fetchRequestFromCwd();

    const packagePatterns = _ref2.requests;


    setUserRequestedPackageVersions(deps, args, flags.latest, packagePatterns, reporter);
    cleanLockfile(lockfile, deps, packagePatterns, reporter);
    addArgs = deps.map(function (dep) {
      return dep.upgradeTo;
    });

    if (flags.scope && validScopeRegex.test(flags.scope)) {
      addArgs = addArgs.filter(function (depName) {
        return depName.startsWith(flags.scope);
      });
    }

    const add = new (_add || _load_add()).Add(addArgs, addFlags, config, reporter, upgradeAll ? new (_lockfile || _load_lockfile()).default() : lockfile);
    yield add.init();
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let getOutdated = exports.getOutdated = (() => {
  var _ref3 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, lockfile, patterns) {
    const install = new (_install || _load_install()).Install(flags, config, reporter, lockfile);
    const outdatedFieldName = flags.latest ? 'latest' : 'wanted';

    // ensure scope is of the form `@scope/`
    const normalizeScope = function normalizeScope() {
      if (flags.scope) {
        if (!flags.scope.startsWith('@')) {
          flags.scope = '@' + flags.scope;
        }

        if (!flags.scope.endsWith('/')) {
          flags.scope += '/';
        }
      }
    };

    const versionFilter = function versionFilter(dep) {
      return dep.current !== dep[outdatedFieldName];
    };

    if (!flags.latest) {
      // these flags only have an affect when --latest is used
      flags.tilde = false;
      flags.exact = false;
      flags.caret = false;
    }

    normalizeScope();

    const deps = (yield (_packageRequest || _load_packageRequest()).default.getOutdatedPackages(lockfile, install, config, reporter, patterns, flags)).filter(versionFilter).filter(scopeFilter.bind(this, flags));
    deps.forEach(function (dep) {
      dep.upgradeTo = buildPatternToUpgradeTo(dep, flags);
      reporter.verbose(reporter.lang('verboseUpgradeBecauseOutdated', dep.name, dep.upgradeTo));
    });

    return deps;
  });

  return function getOutdated(_x5, _x6, _x7, _x8, _x9) {
    return _ref3.apply(this, arguments);
  };
})();

exports.cleanLockfile = cleanLockfile;
exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _add;

function _load_add() {
  return _add = require('./add.js');
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _packageRequest;

function _load_packageRequest() {
  return _packageRequest = _interopRequireDefault(require('../../package-request.js'));
}

var _normalizePattern;

function _load_normalizePattern() {
  return _normalizePattern = require('../../util/normalize-pattern.js');
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// used to detect whether a semver range is simple enough to preserve when doing a --latest upgrade.
// when not matched, the upgraded version range will default to `^` the same as the `add` command would.
const basicSemverOperatorRegex = new RegExp('^(\\^|~|>=|<=)?[^ |&,]+$');

// used to detect if a passed parameter is a scope or a package name.


const validScopeRegex = /^@[a-zA-Z0-9-][a-zA-Z0-9_.-]*\/$/;

// If specific versions were requested for packages, override what getOutdated reported as the latest to install
// Also add ones that are missing, since the requested packages may not have been outdated at all.
function setUserRequestedPackageVersions(deps, args, latest, packagePatterns, reporter) {
  args.forEach(requestedPattern => {
    let found = false;
    let normalized = (0, (_normalizePattern || _load_normalizePattern()).normalizePattern)(requestedPattern);

    // if the user specified a package name without a version range, then that implies "latest"
    // but if the latest flag is not passed then we need to use the version range from package.json
    if (!normalized.hasVersion && !latest) {
      packagePatterns.forEach(packagePattern => {
        const packageNormalized = (0, (_normalizePattern || _load_normalizePattern()).normalizePattern)(packagePattern.pattern);
        if (packageNormalized.name === normalized.name) {
          normalized = packageNormalized;
        }
      });
    }

    const newPattern = `${normalized.name}@${normalized.range}`;

    // if this dependency is already in the outdated list,
    // just update the upgradeTo to whatever version the user requested.
    deps.forEach(dep => {
      if (normalized.hasVersion && dep.name === normalized.name) {
        found = true;
        dep.upgradeTo = newPattern;
        reporter.verbose(reporter.lang('verboseUpgradeBecauseRequested', requestedPattern, newPattern));
      }
    });

    // if this dependency was not in the outdated list,
    // then add a new entry
    if (normalized.hasVersion && !found) {
      deps.push({
        name: normalized.name,
        wanted: '',
        latest: '',
        url: '',
        hint: '',
        range: '',
        current: '',
        upgradeTo: newPattern,
        workspaceName: '',
        workspaceLoc: ''
      });
      reporter.verbose(reporter.lang('verboseUpgradeBecauseRequested', requestedPattern, newPattern));
    }
  });
}

// this function attempts to determine the range operator on the semver range.
// this will only handle the simple cases of a semver starting with '^', '~', '>=', '<=', or an exact version.
// "exotic" semver ranges will not be handled.
function getRangeOperator(version) {
  const result = basicSemverOperatorRegex.exec(version);
  return result ? result[1] || '' : '^';
}

// Attempt to preserve the range operator from the package.json specified semver range.
// If an explicit operator was specified using --exact, --tilde, --caret, then that will take precedence.
function buildPatternToUpgradeTo(dep, flags) {
  if (dep.latest === 'exotic') {
    return `${dep.name}@${dep.url}`;
  }

  const toLatest = flags.latest;
  const toVersion = toLatest ? dep.latest : dep.range;
  let rangeOperator = '';

  if (toLatest) {
    if (flags.caret) {
      rangeOperator = '^';
    } else if (flags.tilde) {
      rangeOperator = '~';
    } else if (flags.exact) {
      rangeOperator = '';
    } else {
      rangeOperator = getRangeOperator(dep.range);
    }
  }

  return `${dep.name}@${rangeOperator}${toVersion}`;
}

function scopeFilter(flags, dep) {
  if (validScopeRegex.test(flags.scope)) {
    return dep.name.startsWith(flags.scope);
  }
  return true;
}

// Remove deps being upgraded from the lockfile, or else Add will use the already-installed version
// instead of the latest for the range.
// We do this recursively so that when Yarn installs the potentially updated transitive deps,
// it may upgrade them too instead of just using the "locked" version from the lockfile.
// Transitive dependencies that are also a direct dependency are skipped.
function cleanLockfile(lockfile, deps, packagePatterns, reporter) {
  function cleanDepFromLockfile(pattern, depth) {
    const lockManifest = lockfile.getLocked(pattern);
    if (!lockManifest || depth > 1 && packagePatterns.some(packagePattern => packagePattern.pattern === pattern)) {
      reporter.verbose(reporter.lang('verboseUpgradeNotUnlocking', pattern));
      return;
    }

    const dependencies = Object.assign({}, lockManifest.dependencies || {}, lockManifest.optionalDependencies || {});
    const depPatterns = Object.keys(dependencies).map(key => `${key}@${dependencies[key]}`);
    reporter.verbose(reporter.lang('verboseUpgradeUnlocking', pattern));
    lockfile.removePattern(pattern);
    depPatterns.forEach(pattern => cleanDepFromLockfile(pattern, depth + 1));
  }

  const patterns = deps.map(dep => dep.upgradeTo);
  patterns.forEach(pattern => cleanDepFromLockfile(pattern, 1));
}

function setFlags(commander) {
  commander.description('Upgrades packages to their latest version based on the specified range.');
  commander.usage('upgrade [flags]');
  commander.option('-S, --scope <scope>', 'upgrade packages under the specified scope');
  commander.option('-L, --latest', 'list the latest version of packages, ignoring version ranges in package.json');
  commander.option('-E, --exact', 'install exact version. Only used when --latest is specified.');
  commander.option('-P, --pattern [pattern]', 'upgrade packages that match pattern');
  commander.option('-T, --tilde', 'install most recent release with the same minor version. Only used when --latest is specified.');
  commander.option('-C, --caret', 'install most recent release with the same major version. Only used when --latest is specified.');
  commander.option('-A', '--audit', 'Run vulnerability audit on installed packages');
}

function hasWrapper(commander, args) {
  return true;
}

const requireLockfile = exports.requireLockfile = true;