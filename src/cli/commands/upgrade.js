/* @flow */

import type {Dependency} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {DependencyRequestPatterns} from '../../types.js';
import {Add} from './add.js';
import Lockfile from '../../lockfile';
import PackageRequest from '../../package-request.js';
import {normalizePattern} from '../../util/normalize-pattern.js';
import {Install} from './install.js';

// used to detect whether a semver range is simple enough to preserve when doing a --latest upgrade.
// when not matched, the upgraded version range will default to `^` the same as the `add` command would.
const basicSemverOperatorRegex = new RegExp('^(\\^|~|>|<=|>=)?[^ |&,]+$');

// used to detect if a passed parameter is a scope or a package name.
const validScopeRegex = /^@[a-zA-Z0-9-][a-zA-Z0-9_.-]*\/$/;

// If specific versions were requested for packages, override what getOutdated reported as the latest to install
// Also add ones that are missing, since the requested packages may not have been outdated at all.
function setUserRequestedPackageVersions(
  deps: Array<Dependency>,
  args: Array<string>,
  latest: boolean,
  packagePatterns,
  reporter: Reporter,
) {
  args.forEach(requestedPattern => {
    let found = false;
    let normalized = normalizePattern(requestedPattern);

    // if the user specified a package name without a version range, then that implies "latest"
    // but if the latest flag is not passed then we need to use the version range from package.json
    if (!normalized.hasVersion && !latest) {
      packagePatterns.forEach(packagePattern => {
        const packageNormalized = normalizePattern(packagePattern.pattern);
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
        workspaceLoc: '',
      });
      reporter.verbose(reporter.lang('verboseUpgradeBecauseRequested', requestedPattern, newPattern));
    }
  });
}

// this function attempts to determine the range operator on the semver range.
// this will only handle the simple cases of a semver starting with '^', '~', '>', '>=', '<=', or an exact version.
// "exotic" semver ranges will not be handled.
function getRangeOperator(version): string {
  const result = basicSemverOperatorRegex.exec(version);
  return result ? result[1] || '' : '^';
}

// Attempt to preserve the range operator from the package.json specified semver range.
// If an explicit operator was specified using --exact, --tilde, --caret, then that will take precedence.
function buildPatternToUpgradeTo(dep, flags): string {
  if (dep.latest === 'exotic') {
    return dep.url;
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

function scopeFilter(flags: Object, dep: Dependency): boolean {
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
export function cleanLockfile(
  lockfile: Lockfile,
  deps: Array<Dependency>,
  packagePatterns: DependencyRequestPatterns,
  reporter: Reporter,
) {
  function cleanDepFromLockfile(pattern: string, depth: number) {
    const lockManifest = lockfile.getLocked(pattern);
    if (!lockManifest || (depth > 1 && packagePatterns.some(packagePattern => packagePattern.pattern === pattern))) {
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

export function setFlags(commander: Object) {
  commander.description('Upgrades packages to their latest version based on the specified range.');
  commander.usage('upgrade [flags]');
  commander.option('-S, --scope <scope>', 'upgrade packages under the specified scope');
  commander.option('-L, --latest', 'list the latest version of packages, ignoring version ranges in package.json');
  commander.option('-E, --exact', 'install exact version. Only used when --latest is specified.');
  commander.option('-P, --pattern [pattern]', 'upgrade packages that match pattern');
  commander.option(
    '-T, --tilde',
    'install most recent release with the same minor version. Only used when --latest is specified.',
  );
  commander.option(
    '-C, --caret',
    'install most recent release with the same major version. Only used when --latest is specified.',
  );
  commander.option('-A', '--audit', 'Run vulnerability audit on installed packages');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export const requireLockfile = true;

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  let addArgs = [];
  const upgradeAll = args.length === 0 && typeof flags.scope === 'undefined' && typeof flags.pattern === 'undefined';
  const addFlags = Object.assign({}, flags, {
    force: true,
    ignoreWorkspaceRootCheck: true,
    workspaceRootIsCwd: config.cwd === config.lockfileFolder,
  });
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);
  const deps = await getOutdated(config, reporter, flags, lockfile, args);
  const install = new Install(flags, config, reporter, lockfile);
  const {requests: packagePatterns} = await install.fetchRequestFromCwd();

  setUserRequestedPackageVersions(deps, args, flags.latest, packagePatterns, reporter);
  cleanLockfile(lockfile, deps, packagePatterns, reporter);
  addArgs = deps.map(dep => dep.upgradeTo);

  if (flags.scope && validScopeRegex.test(flags.scope)) {
    addArgs = addArgs.filter(depName => depName.startsWith(flags.scope));
  }

  const add = new Add(addArgs, addFlags, config, reporter, upgradeAll ? new Lockfile() : lockfile);
  await add.init();
}

export async function getOutdated(
  config: Config,
  reporter: Reporter,
  flags: Object,
  lockfile: Lockfile,
  patterns: Array<string>,
): Promise<Array<Dependency>> {
  const install = new Install(flags, config, reporter, lockfile);
  const outdatedFieldName = flags.latest ? 'latest' : 'wanted';

  // ensure scope is of the form `@scope/`
  const normalizeScope = function() {
    if (flags.scope) {
      if (!flags.scope.startsWith('@')) {
        flags.scope = '@' + flags.scope;
      }

      if (!flags.scope.endsWith('/')) {
        flags.scope += '/';
      }
    }
  };

  const versionFilter = function(dep: Dependency): boolean {
    return dep.current !== dep[outdatedFieldName];
  };

  if (!flags.latest) {
    // these flags only have an affect when --latest is used
    flags.tilde = false;
    flags.exact = false;
    flags.caret = false;
  }

  normalizeScope();

  const deps = (await PackageRequest.getOutdatedPackages(lockfile, install, config, reporter, patterns, flags))
    .filter(versionFilter)
    .filter(scopeFilter.bind(this, flags));
  deps.forEach(dep => {
    dep.upgradeTo = buildPatternToUpgradeTo(dep, flags);
    reporter.verbose(reporter.lang('verboseUpgradeBecauseOutdated', dep.name, dep.upgradeTo));
  });

  return deps;
}
