/* @flow */

import type {Dependency} from '../../types.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Add} from './add.js';
import Lockfile from '../../lockfile';
import PackageRequest from '../../package-request.js';
import {normalizePattern} from '../../util/normalize-pattern.js';
import {Install} from './install.js';

// used to detect whether a semver range is simple enough to preserve when doing a --latest upgrade.
// when not matched, the upgraded version range will default to `^` the same as the `add` command would.
const basicSemverOperatorRegex = new RegExp('^(\\^|~|>|<=|>=)?[^ |&,]+$');

// used to detect if a passed parameter is a scope or a package name.
const validScopeRegex = /^@[a-zA-Z0-9-][a-zA-Z0-9_.-]*\/$/g;

// If specific versions were requested for packages, override what getOutdated reported as the latest to install
// Also add ones that are missing, since the requested packages may not have been outdated at all.
function setUserRequestedPackageVersions(deps: Array<Dependency>, args: Array<string>) {
  args.forEach(requestedPattern => {
    const normalized = normalizePattern(requestedPattern);
    const newPattern = `${normalized.name}@${normalized.range}`;
    let found = false;

    deps.forEach(dep => {
      if (normalized.hasVersion && dep.name === normalized.name) {
        found = true;
        dep.upgradeTo = newPattern;
      }
    });

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
      });
    }
  });
}

export function setFlags(commander: Object) {
  commander.usage('upgrade [flags]');
  commander.option('-S, --scope <scope>', 'upgrade packages under the specified scope');
  commander.option('--latest', 'list the latest version of packages, ignoring version ranges in package.json');
  commander.option('-E, --exact', 'install exact version. Only used when --latest is specified.');
  commander.option(
    '-T, --tilde',
    'install most recent release with the same minor version. Only used when --latest is specified.',
  );
  commander.option(
    '-C, --caret',
    'install most recent release with the same major version. Only used when --latest is specified.',
  );
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export const requireLockfile = true;

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder);
  const deps = await getOutdated(config, reporter, flags, lockfile, args);

  // do not pass the --latest flag to add, otherwise it may ignore the version ranges we already determined.
  const addFlags = Object.assign({}, flags, {force: true, latest: false});

  setUserRequestedPackageVersions(deps, args);

  if (!deps.length) {
    reporter.success(reporter.lang('allDependenciesUpToDate'));
    return;
  }

  // remove deps being upgraded from the lockfile, or else Add will use the already-installed version
  // instead of the latest for the range.
  deps.forEach(dep => lockfile.removePattern(dep.upgradeTo));

  const addArgs = deps.map(dep => dep.upgradeTo);
  const add = new Add(addArgs, addFlags, config, reporter, lockfile);
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

  // this function attempts to determine the range operator on the semver range.
  // this will only handle the simple cases of a semver starting with '^', '~', '>', '>=', '<=', or an exact version.
  // "exotic" semver ranges will not be handled.
  const getRangeOperator = version => {
    const result = basicSemverOperatorRegex.exec(version);
    return result ? result[1] || '' : '^';
  };

  // Attempt to preserve the range operator from the package.json specified semver range.
  // If an explicit operator was specified using --exact, --tilde, --caret, then that will take precedence.
  const buildPatternToUpgradeTo = (dep, flags) => {
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
  };

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

  const scopeFilter = function(dep: Dependency): boolean {
    if (validScopeRegex.test(flags.scope)) {
      return dep.name.startsWith(flags.scope);
    }

    return true;
  };

  if (!flags.latest) {
    // these flags only have an affect when --latest is used
    flags.tilde = false;
    flags.exact = false;
    flags.caret = false;
  }

  normalizeScope();

  const deps = (await PackageRequest.getOutdatedPackages(lockfile, install, config, reporter, patterns))
    .filter(versionFilter)
    .filter(scopeFilter);
  deps.forEach(dep => (dep.upgradeTo = buildPatternToUpgradeTo(dep, flags)));

  return deps;
}
