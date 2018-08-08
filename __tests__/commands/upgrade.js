/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {explodeLockfile, run as buildRun} from './_helpers.js';
import {run as upgrade} from '../../src/cli/commands/upgrade.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'upgrade');
const runUpgrade = buildRun.bind(null, ConsoleReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  config.commandName = 'upgrade';
  return upgrade(config, reporter, flags, args);
});

const _expectDependency = async (depType, config, name, range, expectedVersion) => {
  const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
  const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
  expect(pkg[depType][name]).toBeDefined();
  expect(pkg[depType][name]).toEqual(range);
  const pattern = name.startsWith('@') ? `"${name}@${range}"` : `${name}@${range}`;
  expect(lockfile).toContainPackage(`${pattern}:`, expectedVersion);
};

const expectInstalledDependency = async (config, name, range, expectedVersion) => {
  await _expectDependency('dependencies', config, name, range, expectedVersion);
};

const expectInstalledDevDependency = async (config, name, range, expectedVersion) => {
  await _expectDependency('devDependencies', config, name, range, expectedVersion);
};

const expectInstalledTransitiveDependency = async (config, name, range, expectedVersion) => {
  const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
  expect(lockfile).toContainPackage(`${name}@${range}:`, expectedVersion);
};

expect.extend({
  toContainPackage(lockfile, ...args): Object {
    const [pattern, expectedVersion] = args;
    const patternIndex = lockfile.indexOf(pattern);
    const versionIndex = patternIndex + 1;
    const actualVersion = lockfile[versionIndex];
    const pass = patternIndex >= 0 && actualVersion === `  version "${expectedVersion}"`;
    const failReason =
      patternIndex < 0 ? `${pattern.toString()} is not in the lockfile` : `actual installed ${actualVersion}`;

    return {
      message: () => `expected lockfile to contain ${pattern} at version ${expectedVersion}, but ${failReason}.`,
      pass,
    };
  },
});

test.concurrent('throws if lockfile is out of date', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async resolve => {
    try {
      await runUpgrade([], {}, 'lockfile-outdated');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('lockfileOutdated'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('works with no arguments', (): Promise<void> => {
  return runUpgrade([], {}, 'no-args', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.0.0', '1.1.3');
  });
});

test.concurrent('upgrades transitive deps when no arguments', (): Promise<void> => {
  return runUpgrade([], {}, 'with-subdep', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'strip-ansi', '^2.0.1', '2.0.1');
    await expectInstalledTransitiveDependency(config, 'ansi-regex', '^1.0.0', '1.1.1');
    await expectInstalledDependency(config, 'array-union', '^1.0.1', '1.0.2');
    await expectInstalledTransitiveDependency(config, 'array-uniq', '^1.0.1', '1.0.3');
  });
});

test.concurrent('does not upgrade transitive deps that are also a direct dependency', (): Promise<void> => {
  return runUpgrade(['strip-ansi'], {}, 'with-subdep-also-direct', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'strip-ansi', '^2.0.1', '2.0.1');
    await expectInstalledTransitiveDependency(config, 'ansi-regex', '^1.0.0', '1.0.0');
    await expectInstalledDependency(config, 'ansi-regex', '^1.0.0', '1.0.0');
  });
});

test.concurrent('does not upgrade transitive deps when specific package upgraded', (): Promise<void> => {
  return runUpgrade(['strip-ansi'], {}, 'with-subdep', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'strip-ansi', '^2.0.1', '2.0.1');
    await expectInstalledTransitiveDependency(config, 'ansi-regex', '^1.0.0', '1.1.1');
    await expectInstalledDependency(config, 'array-union', '^1.0.1', '1.0.1');
    await expectInstalledTransitiveDependency(config, 'array-uniq', '^1.0.1', '1.0.1');
  });
});

test.concurrent('works with single argument', (): Promise<void> => {
  return runUpgrade(['max-safe-integer'], {}, 'single-package', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.0.0', '1.0.0');
    await expectInstalledDependency(config, 'max-safe-integer', '^1.0.0', '1.0.1');
  });
});

test.concurrent('works with multiple arguments', (): Promise<void> => {
  return runUpgrade(['left-pad', 'max-safe-integer'], {}, 'multiple-packages', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.0.0', '1.1.3');
    await expectInstalledDependency(config, 'max-safe-integer', '^1.0.0', '1.0.1');
    await expectInstalledDependency(config, 'array-union', '^1.0.1', '1.0.1');
  });
});

test.concurrent('respects dependency type', (): Promise<void> => {
  return runUpgrade(['left-pad@^1.1.3'], {}, 'respects-dependency-type', async (config): ?Promise<void> => {
    await expectInstalledDevDependency(config, 'left-pad', '^1.1.3', '1.1.3');
    await expectInstalledDependency(config, 'max-safe-integer', '^1.0.0', '1.0.0');
  });
});

test.concurrent('respects --ignore-engines flag', (): Promise<void> => {
  return runUpgrade(['hawk@4.1'], {ignoreEngines: true}, 'respects-ignore-engines-flag', async (config): ?Promise<
    void,
  > => {
    await expectInstalledDependency(config, 'hawk', '4.1', '4.1.2');
  });
});

test.concurrent('upgrades from fixed version to latest', (): Promise<void> => {
  return runUpgrade(['max-safe-integer'], {latest: true}, 'fixed-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'max-safe-integer', '1.0.1', '1.0.1');
  });
});

test.concurrent('upgrades from fixed version to latest with workspaces', (): Promise<void> => {
  return runUpgrade(['max-safe-integer'], {latest: true}, 'fixed-to-latest-workspaces', async (config): ?Promise<
    void,
  > => {
    await expectInstalledDevDependency(config, 'max-safe-integer', '1.0.1', '1.0.1');
  });
});

test.concurrent('works with just a pattern', (): Promise<void> => {
  return runUpgrade([], {pattern: 'max'}, 'multiple-packages', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.0.0', '1.0.0');
    await expectInstalledDependency(config, 'max-safe-integer', '^1.0.0', '1.0.1');
    await expectInstalledDependency(config, 'array-union', '^1.0.1', '1.0.1');
  });
});

test.concurrent('works with arguments and a pattern', (): Promise<void> => {
  return runUpgrade(['left-pad'], {pattern: 'max'}, 'multiple-packages', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.0.0', '1.1.3');
    await expectInstalledDependency(config, 'max-safe-integer', '^1.0.0', '1.0.1');
    await expectInstalledDependency(config, 'array-union', '^1.0.1', '1.0.1');
  });
});

test.concurrent('upgrades to latest matching package.json semver when no package name passed', (): Promise<void> => {
  return runUpgrade([], {}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '<=1.1.1', '1.1.1');
  });
});

test.concurrent('--latest upgrades to latest ignoring package.json when no package name passed', (): Promise<void> => {
  return runUpgrade([], {latest: true}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '<=1.1.3', '1.1.3');
  });
});

test.concurrent('--latest preserves "<=" semver range', (): Promise<void> => {
  return runUpgrade([], {latest: true}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '<=1.1.3', '1.1.3');
  });
});

test.concurrent('--latest preserves "^" semver range', (): Promise<void> => {
  return runUpgrade([], {latest: true}, 'caret-range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.1.3', '1.1.3');
  });
});

test.concurrent('--latest preserves "~" semver range', (): Promise<void> => {
  return runUpgrade([], {latest: true}, 'tilde-range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '~1.1.3', '1.1.3');
  });
});

test.concurrent('--latest defaults to "^" semver range if existing range is complex', (): Promise<void> => {
  return runUpgrade([], {latest: true}, 'complex-range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.1.3', '1.1.3');
  });
});

test.concurrent('sets new version range to caret when --caret and --latest are passed', (): Promise<void> => {
  return runUpgrade([], {latest: true, caret: true}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '^1.1.3', '1.1.3');
  });
});

test.concurrent('sets new version range to tilde when --tilde and --latest are passed', (): Promise<void> => {
  return runUpgrade([], {latest: true, tilde: true}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '~1.1.3', '1.1.3');
  });
});

test.concurrent('sets new version range to exact when --exact and --latest are passed', (): Promise<void> => {
  return runUpgrade([], {latest: true, exact: true}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '1.1.3', '1.1.3');
  });
});

test.concurrent('upgrades to latest matching semver when package name passed with version', (): Promise<void> => {
  return runUpgrade(['left-pad@~1.1.2'], {}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '~1.1.2', '1.1.3');
  });
});

test.concurrent('--latest upgrades to passed in version when package name passed with version', (): Promise<void> => {
  return runUpgrade(['left-pad@1.1.2'], {latest: true}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '1.1.2', '1.1.2');
  });
});

test.concurrent('upgrades to latest matching package.json semver when package name passed', (): Promise<void> => {
  return runUpgrade(['left-pad'], {}, 'range-to-latest', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '<=1.1.1', '1.1.1');
  });
});

test.concurrent('upgrades dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = sha => lockfile.indexOf(`  resolved "${gitRemote}#${sha}"`) > -1;

    expect(lockfile.indexOf(`"yarn-test-git-repo@${gitRemote}#master":`)).toBeGreaterThan(-1);
    expect(lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40')).toEqual(false);
    expect(lockfile.indexOf(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`)).toBeGreaterThan(-1);
    expect(lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705')).toEqual(true);
  });
});

test.concurrent('upgrades dev dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-dev', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = sha => lockfile.indexOf(`  resolved "${gitRemote}#${sha}"`) > -1;

    expect(lockfile.indexOf(`"yarn-test-git-repo@${gitRemote}#master":`)).toBeGreaterThan(-1);
    expect(lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40')).toEqual(false);
    expect(lockfile.indexOf(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`)).toBeGreaterThan(-1);
    expect(lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705')).toEqual(true);
  });
});

test.concurrent('upgrades optional dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-optional', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = sha => lockfile.indexOf(`  resolved "${gitRemote}#${sha}"`) > -1;

    expect(lockfile.indexOf(`"yarn-test-git-repo@${gitRemote}#master":`)).toBeGreaterThan(-1);
    expect(lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40')).toEqual(false);
    expect(lockfile.indexOf(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`)).toBeGreaterThan(-1);
    expect(lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705')).toEqual(true);
  });
});

test.concurrent('informs the type of dependency after upgrade', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      config.commandName = 'upgrade';
      await upgrade(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const infos = output.filter(({type}) => type === 'info');
      const getTreeInfo = pkgName =>
        output.filter(
          ({type, data: {trees = []}}) => type === 'tree' && trees.some(({name}) => name.indexOf(pkgName) > -1),
        );

      expect(
        infos.some(info => {
          return info.data.toString().indexOf('Direct dependencies') > -1;
        }),
      ).toEqual(true);
      expect(getTreeInfo('async')).toHaveLength(2);
      expect(getTreeInfo('lodash')).toHaveLength(1);
    },
    ['async'],
    {latest: true},
    'direct-dependency',
  );
});

test.concurrent('warns when peer dependency is not met after upgrade', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      config.commandName = 'upgrade';

      await upgrade(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('incorrect peer') > -1;
        }),
      ).toEqual(true);
    },
    ['themer'],
    {latest: true},
    'peer-dependency-warn',
  );
});

test.concurrent("doesn't warn when peer dependency is still met after upgrade", (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      config.commandName = 'upgrade';

      await upgrade(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('peer') > -1;
        }),
      ).toEqual(false);
    },
    ['themer'],
    {},
    'peer-dependency-no-warn',
  );
});

// Regression test for #4840
test.concurrent("doesn't warn when upgrading a devDependency", (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      config.commandName = 'upgrade';

      await upgrade(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('is already in') > -1;
        }),
      ).toEqual(false);
    },
    ['left-pad'],
    {},
    'dev-dependency-no-warn',
  );
});

test.concurrent('can prune the offline mirror', (): Promise<void> => {
  return runUpgrade(['left-pad@1.1.2'], {}, 'prune-offline-mirror', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'left-pad', '1.1.2', '1.1.2');

    const mirrorPath = 'mirror-for-offline';
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/left-pad-1.1.2.tgz`))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/left-pad-1.1.1.tgz`))).toEqual(false);
  });
});

test.concurrent('respects --scope flag', (): Promise<void> => {
  return runUpgrade([], {scope: '@angular', latest: true}, 'respects-scope-flag', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('"@angular-mdl/core@4.0.0":')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('"@angular/core@2.4.9":')).toEqual(-1);
    expect(lockfile.indexOf('left-pad@1.0.0:')).toBeGreaterThanOrEqual(0);

    expect(pkg.dependencies['@angular-mdl/core']).toEqual('4.0.0');
    expect(pkg.dependencies['@angular/core']).not.toEqual('2.4.9');
    expect(pkg.dependencies['left-pad']).toEqual('1.0.0');
  });
});

test.concurrent('respects --scope flag with caret', (): Promise<void> => {
  return runUpgrade([], {scope: '@angular'}, 'respects-scope-flag-with-caret', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, '@angular-mdl/core', '^4.0.0', '4.0.0');
    await expectInstalledDependency(config, '@angular/core', '^2.4.9', '2.4.10');
    await expectInstalledDependency(config, 'left-pad', '^1.0.0', '1.0.0');
  });
});

test.concurrent('--latest works if there is an install script on a hoisted dependency', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      config.commandName = 'upgrade';

      await upgrade(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const errors = output.filter(entry => entry.type === 'error');

      expect(errors.length).toEqual(0);
    },
    [],
    {latest: true},
    'latest-with-install-script',
  );
});

test.concurrent('upgrade to workspace root preserves child dependencies', (): Promise<void> => {
  return runUpgrade(['max-safe-integer@1.0.1'], {latest: true}, 'workspaces', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));

    // child workspace deps
    expect(lockfile.indexOf('left-pad@1.0.0:')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('right-pad@1.0.0:')).toBeGreaterThanOrEqual(0);
    // root dep
    expect(lockfile.indexOf('max-safe-integer@1.0.0:')).toBe(-1);
    expect(lockfile.indexOf('max-safe-integer@1.0.1:')).toBeGreaterThanOrEqual(0);

    const rootPkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    expect(rootPkg.devDependencies['max-safe-integer']).toEqual('1.0.1');

    const childAPkg = await fs.readJson(path.join(config.cwd, 'child-a/package.json'));
    const childBPkg = await fs.readJson(path.join(config.cwd, 'child-b/package.json'));
    expect(childAPkg.dependencies['left-pad']).toEqual('1.0.0');
    expect(childBPkg.dependencies['right-pad']).toEqual('1.0.0');
  });
});

test.concurrent('upgrade to workspace child preserves root dependencies', (): Promise<void> => {
  const fixture = {source: 'workspaces', cwd: 'child-a'};
  return runUpgrade(['left-pad@1.1.0'], {latest: true}, fixture, async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.lockfileFolder, 'yarn.lock')));

    // untouched deps
    expect(lockfile.indexOf('right-pad@1.0.0:')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('max-safe-integer@1.0.0:')).toBeGreaterThanOrEqual(0);
    // upgraded child workspace
    expect(lockfile.indexOf('left-pad@1.0.0:')).toBe(-1);
    expect(lockfile.indexOf('left-pad@1.1.0:')).toBeGreaterThanOrEqual(0);

    const childAPkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    expect(childAPkg.dependencies['left-pad']).toEqual('1.1.0');

    const rootPkg = await fs.readJson(path.join(config.lockfileFolder, 'package.json'));
    const childBPkg = await fs.readJson(path.join(config.lockfileFolder, 'child-b/package.json'));
    expect(rootPkg.devDependencies['max-safe-integer']).toEqual('1.0.0');
    expect(childBPkg.dependencies['right-pad']).toEqual('1.0.0');
  });
});

test.concurrent('latest flag does not downgrade from a beta', (): Promise<void> => {
  return runUpgrade([], {latest: true}, 'using-beta', async (config): ?Promise<void> => {
    await expectInstalledDependency(config, 'react-refetch', '^1.0.3-0', '1.0.3-0');
  });
});
