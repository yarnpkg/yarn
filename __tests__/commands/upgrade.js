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
  return upgrade(config, reporter, flags, args);
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
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('left-pad@^1.0.0:')).toEqual(0);
    // the below test passes when it should fail
    // manifest doesn't get updated when ran without args
    expect(pkg.dependencies).toEqual({'left-pad': '^1.0.0'});
  });
});

test.concurrent('works with single argument', (): Promise<void> => {
  return runUpgrade(['max-safe-integer'], {}, 'single-package', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('left-pad@^1.0.0:')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('max-safe-integer@^1.0.1:')).toBeGreaterThanOrEqual(0);
    expect(pkg.dependencies['left-pad']).toEqual('^1.0.0');
    expect(pkg.dependencies['max-safe-integer']).not.toEqual('^1.0.0');
  });
});

test.concurrent('works with multiple arguments', (): Promise<void> => {
  return runUpgrade(['left-pad', 'max-safe-integer'], {}, 'multiple-packages', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('left-pad@^1.1.3:')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('max-safe-integer@^1.0.1:')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('is-negative-zero@^1.0.0:')).toBeGreaterThanOrEqual(0);

    expect(pkg.dependencies['left-pad']).not.toEqual('^1.0.0');
    expect(pkg.dependencies['max-safe-integer']).not.toEqual('^1.0.0');
    expect(pkg.dependencies['is-negative-zero']).toEqual('^1.0.0');
  });
});

test.concurrent('respects dependency type', (): Promise<void> => {
  return runUpgrade(['left-pad@^1.1.3'], {}, 'respects-dependency-type', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('max-safe-integer@^1.0.0:')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('left-pad@^1.1.3:')).toBeGreaterThanOrEqual(0);
    expect(pkg.dependencies).toEqual({'max-safe-integer': '^1.0.0'});
    expect(pkg.devDependencies).toEqual({'left-pad': '^1.1.3'});
  });
});

test.concurrent('respects --ignore-engines flag', (): Promise<void> => {
  return runUpgrade(['hawk@0.10'], {ignoreEngines: true}, 'respects-ignore-engines-flag', async (config): ?Promise<
    void,
  > => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('hawk@0.10:')).toBeGreaterThanOrEqual(0);
    expect(pkg.dependencies).toEqual({hawk: '0.10'});
  });
});

test.concurrent('upgrades from fixed version to latest', (): Promise<void> => {
  return runUpgrade(['max-safe-integer'], {}, 'fixed-to-latest', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(lockfile.indexOf('max-safe-integer@^1.0.1:')).toEqual(0);
    expect(pkg.dependencies).toEqual({'max-safe-integer': '^1.0.1'});
  });
});

test.concurrent('upgrades to latest matching package.json semver when no package name passed', (): Promise<void> => {
  return runUpgrade([], {}, 'range-to-latest', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const lockEntryIndex = lockfile.indexOf('left-pad@<=1.1.1:');

    expect(lockEntryIndex).toEqual(0);
    expect(lockfile[lockEntryIndex + 1]).toContain('1.1.1');
    expect(pkg.dependencies).toEqual({'left-pad': '<=1.1.1'});
  });
});

test.concurrent('--latest upgrades to latest ignoring package.json when no package name passed', (): Promise<void> => {
  return runUpgrade([], {latest: true}, 'range-to-latest', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const lockEntryIndex = lockfile.indexOf('left-pad@^1.1.3:');

    expect(lockEntryIndex).toEqual(0);
    expect(lockfile.indexOf('left-pad@<=1.1.1:')).toEqual(-1);
    expect(lockfile[lockEntryIndex + 1]).toContain('1.1.3');
    expect(pkg.dependencies).toEqual({'left-pad': '^1.1.3'});
  });
});

test.concurrent('upgrades to latest matching semver when package name passed with version', (): Promise<void> => {
  return runUpgrade(['left-pad@~1.1.2'], {}, 'range-to-latest', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const lockEntryIndex = lockfile.indexOf('left-pad@~1.1.2:');

    expect(lockEntryIndex).toEqual(0);
    expect(lockfile[lockEntryIndex + 1]).toContain('1.1.3');
    expect(pkg.dependencies).toEqual({'left-pad': '~1.1.2'});
  });
});

test.concurrent('--latest upgrades to passed in version when package name passed with version', (): Promise<void> => {
  return runUpgrade(['left-pad@1.1.2'], {latest: true}, 'range-to-latest', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const lockEntryIndex = lockfile.indexOf('left-pad@1.1.2:');

    expect(lockEntryIndex).toEqual(0);
    expect(lockfile.indexOf('left-pad@<=1.1.1:')).toEqual(-1);
    expect(lockfile.indexOf('left-pad@^1.1.3:')).toEqual(-1);
    expect(lockfile[lockEntryIndex + 1]).toContain('1.1.2');
    expect(pkg.dependencies).toEqual({'left-pad': '1.1.2'});
  });
});

test.concurrent('upgrades to latest ignoring package.json semver when package name passed', (): Promise<void> => {
  return runUpgrade(['left-pad'], {}, 'range-to-latest', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const lockEntryIndex = lockfile.indexOf('left-pad@^1.1.3:');

    expect(lockEntryIndex).toEqual(0);
    expect(lockfile.indexOf('left-pad@<=1.1.1:')).toEqual(-1);
    expect(lockfile[lockEntryIndex + 1]).toContain('1.1.3');
    expect(pkg.dependencies).toEqual({'left-pad': '^1.1.3'});
  });
});

test.concurrent('upgrades dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = sha => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    // Lockfile should point to the same yarn-test-git-repo branch
    expect(lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`)).toEqual(true);

    // Lockfile should update yarn-test-git-repo SHA
    expect(lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40')).toEqual(false);

    // Lockfile should point to the same e2e-test-repo branch
    expect(lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`)).toEqual(true);

    // Lockfile should keep latest e2e-test-repo SHA
    expect(lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705')).toEqual(true);
  });
});

test.concurrent('upgrades dev dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-dev', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = sha => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    // Lockfile should point to the same yarn-test-git-repo branch
    expect(lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`)).toEqual(true);

    // Lockfile should update yarn-test-git-repo SHA
    expect(lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40')).toEqual(false);

    // Lockfile should point to the same e2e-test-repo branch
    expect(lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`)).toEqual(true);

    // Lockfile should keep latest e2e-test-repo SHA
    expect(lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705')).toEqual(true);
  });
});

test.concurrent('upgrades optional dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-optional', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = sha => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    // Lockfile should point to the same yarn-test-git-repo branch
    expect(lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`)).toEqual(true);

    // Lockfile should update yarn-test-git-repo SHA
    expect(lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40')).toEqual(false);

    // Lockfile should point to the same e2e-test-repo branch
    expect(lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`)).toEqual(true);

    // Lockfile should keep latest e2e-test-repo SHA
    expect(lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705')).toEqual(true);
  });
});

test.concurrent('upgrades peer dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-peer', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = sha => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    // Lockfile should point to the same yarn-test-git-repo branch
    expect(lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`)).toEqual(true);

    // Lockfile should update yarn-test-git-repo SHA
    expect(lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40')).toEqual(false);

    // Lockfile should point to the same e2e-test-repo branch
    expect(lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`)).toEqual(true);

    // Lockfile should keep latest e2e-test-repo SHA
    expect(lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705')).toEqual(true);
  });
});

test.concurrent('warns when peer dependency is not met after upgrade', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      await upgrade(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().includes('incorrect peer');
        }),
      ).toEqual(true);
    },
    ['themer'],
    {},
    'peer-dependency-warn',
  );
});

test.concurrent("doesn't warn when peer dependency is still met after upgrade", (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      await upgrade(config, reporter, flags, args);

      const output = reporter.getBuffer();
      const warnings = output.filter(entry => entry.type === 'warning');

      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().includes('peer');
        }),
      ).toEqual(false);
    },
    ['themer'],
    {},
    'peer-dependency-no-warn',
  );
});

test.concurrent('can prune the offline mirror', (): Promise<void> => {
  return runUpgrade(['dep-a@1.1.0'], {}, 'prune-offline-mirror', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    expect(lockfile.indexOf('dep-a@1.1.0:')).toEqual(0);

    const mirrorPath = 'mirror-for-offline';
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.1.0.tgz`))).toEqual(true);
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`))).toEqual(false);
    // In 1.1.0, dep-a doesn't depend on dep-b anymore, so dep-b should be pruned
    expect(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-b-1.0.0.tgz`))).toEqual(false);
  });
});

test.concurrent('respects --scope flag', (): Promise<void> => {
  return runUpgrade([], {scope: '@angular'}, 'respects-scope-flag', async (config): ?Promise<void> => {
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
