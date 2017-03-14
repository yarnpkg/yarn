/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {explodeLockfile, run as buildRun} from './_helpers.js';
import {run as upgrade} from '../../src/cli/commands/upgrade.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';
import assert from 'assert';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'upgrade');
const runUpgrade = buildRun.bind(null, ConsoleReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  return upgrade(config, reporter, flags, args);
});

test.concurrent('throws if lockfile is out of date', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve) => {
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

    assert(lockfile.indexOf('left-pad@^1.0.0:') === 0);
    // the below test passes when it should fail
    // manifest doesn't get updated when ran without args
    assert.deepEqual(pkg.dependencies, {'left-pad': '^1.0.0'});
  });
});

test.concurrent('works with single argument', (): Promise<void> => {
  return runUpgrade(['max-safe-integer'], {}, 'single-package', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('left-pad@^1.0.0:') >= 0);
    assert(lockfile.indexOf('max-safe-integer@^1.0.1:') >= 0);
    assert.equal(pkg.dependencies['left-pad'], '^1.0.0');
    assert.notEqual(pkg.dependencies['max-safe-integer'], '^1.0.0');
  });
});

test.concurrent('works with multiple arguments', (): Promise<void> => {
  return runUpgrade(['left-pad', 'max-safe-integer'], {}, 'multiple-packages',
    async (config): ?Promise<void> => {
      const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
      const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

      assert(lockfile.indexOf('left-pad@^1.1.3:') >= 0);
      assert(lockfile.indexOf('max-safe-integer@^1.0.1:') >= 0);
      assert(lockfile.indexOf('is-negative-zero@^1.0.0:') >= 0);
      assert.notEqual(pkg.dependencies['left-pad'], '^1.0.0');
      assert.notEqual(pkg.dependencies['max-safe-integer'], '^1.0.0');
      assert.equal(pkg.dependencies['is-negative-zero'], '^1.0.0');
    },
  );
});

test.concurrent('respects dependency type', (): Promise<void> => {
  return runUpgrade(['left-pad@^1.1.3'], {}, 'respects-dependency-type', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('max-safe-integer@^1.0.0:') >= 0);
    assert(lockfile.indexOf('left-pad@^1.1.3:') >= 0);
    assert.deepEqual(pkg.dependencies, {'max-safe-integer': '^1.0.0'});
    assert.deepEqual(pkg.devDependencies, {'left-pad': '^1.1.3'});
  });
});

test.concurrent('respects --ignore-engines flag', (): Promise<void> => {
  return runUpgrade(['hawk@0.10'], {ignoreEngines: true}, 'respects-ignore-engines-flag',
    async (config): ?Promise<void> => {
      const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
      const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

      assert(lockfile.indexOf('hawk@0.10:') >= 0);
      assert.deepEqual(pkg.dependencies, {hawk: '0.10'});
    },
  );
});

test.concurrent('upgrades from fixed version to latest', (): Promise<void> => {
  return runUpgrade(['max-safe-integer'], {}, 'fixed-to-latest', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    assert(lockfile.indexOf('max-safe-integer@^1.0.1:') === 0);
    assert.deepEqual(pkg.dependencies, {'max-safe-integer': '^1.0.1'});
  });
});

test.concurrent('upgrades dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = (sha) => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    assert(
      lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`),
      'Lockfile should point to the same yarn-test-git-repo branch.',
    );

    assert(
      !lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40'),
      'Lockfile should update yarn-test-git-repo SHA.',
    );

    assert(
      lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`),
      'Lockfile should point to the same e2e-test-repo branch.',
    );

    assert(
      lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705'),
      'Lockfile should keep latest e2e-test-repo SHA.',
    );
  });
});

test.concurrent('upgrades dev dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-dev', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = (sha) => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    assert(
      lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`),
      'Lockfile should point to the same yarn-test-git-repo branch.',
    );

    assert(
      !lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40'),
      'Lockfile should update yarn-test-git-repo SHA.',
    );

    assert(
      lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`),
      'Lockfile should point to the same e2e-test-repo branch.',
    );

    assert(
      lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705'),
      'Lockfile should keep latest e2e-test-repo SHA.',
    );
  });
});

test.concurrent('upgrades optional dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-optional', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = (sha) => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    assert(
      lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`),
      'Lockfile should point to the same yarn-test-git-repo branch.',
    );

    assert(
      !lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40'),
      'Lockfile should update yarn-test-git-repo SHA.',
    );

    assert(
      lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`),
      'Lockfile should point to the same e2e-test-repo branch.',
    );

    assert(
      lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705'),
      'Lockfile should keep latest e2e-test-repo SHA.',
    );
  });
});

test.concurrent('upgrades peer dependency packages not in registry', (): Promise<void> => {
  const packages = ['yarn-test-git-repo', 'e2e-test-repo'];
  return runUpgrade(packages, {}, 'package-not-in-registry-peer', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    const gitRemote = 'https://github.com/yarnpkg/e2e-test-repo';

    const lockFileIncludes = (sha) => lockfile.includes(`  resolved "${gitRemote}#${sha}"`);

    assert(
      lockfile.includes(`"yarn-test-git-repo@${gitRemote}#master":`),
      'Lockfile should point to the same yarn-test-git-repo branch.',
    );

    assert(
      !lockFileIncludes('d2027157d0c7188fc9ed6a6654325d1e3bf4db40'),
      'Lockfile should update yarn-test-git-repo SHA.',
    );

    assert(
      lockfile.includes(`"e2e-test-repo@${gitRemote}#greenkeeper/cross-env-3.1.4":`),
      'Lockfile should point to the same e2e-test-repo branch.',
    );

    assert(
      lockFileIncludes('da5940e1ad2b7451c00edffb6e755bf2411fc705'),
      'Lockfile should keep latest e2e-test-repo SHA.',
    );
  });
});

test.concurrent('warns when peer dependency is not met after upgrade', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      await upgrade(config, reporter, flags, args);
      const output = reporter.getBuffer();
      const warnings = output.filter((entry) => entry.type === 'warning');
      assert(warnings.some((warning) => warning.data.toString().toLowerCase().includes('incorrect peer')));
    },
    ['themer'],
    {},
    'peer-dependency-warn',
  );
});

test.concurrent('doesn\'t warn when peer dependency is still met after upgrade', (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    fixturesLoc,
    async (args, flags, config, reporter): Promise<void> => {
      await upgrade(config, reporter, flags, args);
      const output = reporter.getBuffer();
      const warnings = output.filter((entry) => entry.type === 'warning');
      assert(!warnings.some((warning) => warning.data.toString().toLowerCase().includes('peer')));
    },
    ['themer'],
    {},
    'peer-dependency-no-warn',
  );
});

test.concurrent('can prune the offline mirror', (): Promise<void> => {
  return runUpgrade(['dep-a@1.1.0'], {}, 'prune-offline-mirror', async (config): ?Promise<void> => {
    const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
    assert(lockfile.indexOf('dep-a@1.1.0:') === 0);

    const mirrorPath = 'mirror-for-offline';
    assert(await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.1.0.tgz`)));
    assert(!await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-a-1.0.0.tgz`)));
    // In 1.1.0, dep-a doesn't depend on dep-b anymore, so dep-b should be pruned
    assert(!await fs.exists(path.join(config.cwd, `${mirrorPath}/dep-b-1.0.0.tgz`)));
  });
});
