/* @flow */

import * as reporters from '../../../src/reporters/index.js';
import * as fs from '../../../src/util/fs.js';
import {runInstall} from '../_helpers.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');

test.concurrent('focus does not work from a non-workspaces project', async (): Promise<void> => {
  let error = '';
  const reporter = new reporters.ConsoleReporter({});
  try {
    await runInstall({focus: true}, 'install-production');
  } catch (e) {
    error = e.message;
  }
  expect(error).toContain(reporter.lang('workspacesFocusRootCheck'));
});

test.concurrent('focus does not work from the root of a workspaces project', async (): Promise<void> => {
  let error = '';
  const reporter = new reporters.ConsoleReporter({});
  try {
    await runInstall({focus: true}, 'published-monorepo');
  } catch (e) {
    error = e.message;
  }
  expect(error).toContain(reporter.lang('workspacesFocusRootCheck'));
});

test.concurrent('focus does a normal workspace installation', (): Promise<void> => {
  return runInstall(
    {focus: true},
    {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-1'},
    async (config): Promise<void> => {
      const packageFile = await fs.readFile(
        path.join(config.cwd, '..', '..', 'node_modules', 'example-yarn-workspace-2', 'package.json'),
      );
      expect(JSON.parse(packageFile).version).toEqual('1.1.1');
      const readme = await fs.readFile(
        path.join(config.cwd, '..', '..', 'node_modules', 'example-yarn-workspace-2', 'README.md'),
      );
      expect(readme.split('\n')[0]).toEqual('WORKSPACES ROCK2!');
    },
  );
});

test.concurrent('focus shallowly installs sibling workspaces under target', (): Promise<void> => {
  return runInstall(
    {focus: true},
    {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-1'},
    async (config): Promise<void> => {
      const packageFile = await fs.readFile(
        path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2', 'package.json'),
      );
      expect(JSON.parse(packageFile).version).toEqual('1.1.1');
      const readme = await fs.readFile(path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2', 'README.md'));
      expect(readme.split('\n')[0]).toEqual('WORKSPACES ROCK2!');
    },
  );
});

test.concurrent('focus should not bail out early after an un-focused install', (): Promise<void> => {
  return runInstall({}, 'published-monorepo', async (config, reporter) => {
    const oldCwd = config.cwd;

    await fs.writeFile(path.join(oldCwd, 'node_modules', 'yarn.test'), 'YARN TEST');

    config.cwd += '/packages/example-yarn-workspace-1';
    config.focus = true;
    config.focusedWorkspaceName = 'example-yarn-workspace-1';

    const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(oldCwd));
    await reinstall.init();

    expect(await fs.exists(path.join(oldCwd, 'node_modules', 'yarn.test'))).toBeFalsy();
  });
});

test.concurrent('repeated focused installs should bail out early', (): Promise<void> => {
  return runInstall(
    {focus: true},
    {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-1'},
    async (config, reporter) => {
      await fs.writeFile(path.join(config.cwd, 'node_modules', 'yarn.test'), 'YARN TEST');

      const lockfileDir = path.join(config.cwd, '..', '..');

      const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(lockfileDir));
      await reinstall.init();

      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'yarn.test'))).toBeTruthy();

      await fs.unlink(path.join(config.cwd, 'node_modules', 'yarn.test'));
    },
  );
});

test.concurrent('switching directories for focused installs should fail integrity checks and reinstall', (): Promise<
  void,
> => {
  return runInstall(
    {focus: true},
    {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-1'},
    async (config, reporter) => {
      const rootDir = path.join(config.cwd, '..', '..');

      await fs.writeFile(path.join(rootDir, 'node_modules', 'yarn.test'), 'YARN TEST');

      config.cwd = path.join(rootDir, 'packages', 'example-yarn-workspace-2');
      config.focusedWorkspaceName = 'example-yarn-workspace-2';

      const reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(rootDir));
      await reinstall.init();

      expect(await fs.exists(path.join(rootDir, 'node_modules', 'yarn.test'))).toBeFalsy();
    },
  );
});

test.concurrent(
  'focus shallowly installs anything that a sibling needed to shallowly install underneath that sibling',
  (): Promise<void> => {
    return runInstall(
      {focus: true},
      {source: 'focus-conflicts', cwd: '/packages/example-yarn-workspace-1'},
      async (config, reporter) => {
        const packageFile = await fs.readFile(
          path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2', 'node_modules', 'left-pad', 'package.json'),
        );
        expect(JSON.parse(packageFile).version).toEqual('1.1.2');
      },
    );
  },
);

test.concurrent("focus does not shallowly install a sibling's dev dependencies", (): Promise<void> => {
  return runInstall(
    {focus: true},
    {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-4'},
    async (config, reporter) => {
      expect(
        await fs.exists(path.join(config.cwd, 'node_modules', 'example-yarn-workspace-3', 'node_modules', 'left-pad')),
      ).toBeFalsy();
    },
  );
});

test.concurrent("focus runs shallow dependencies' postinstall scripts", (): Promise<void> => {
  return runInstall(
    {focus: true},
    {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-4'},
    async (config, reporter) => {
      expect(
        await fs.exists(path.join(config.cwd, 'node_modules', 'example-yarn-workspace-3', 'temp.out')),
      ).toBeTruthy();
    },
  );
});

test.concurrent('focus installs transitive dependencies shallowly', (): Promise<void> => {
  return runInstall(
    {focus: true},
    {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-4'},
    async (config, reporter) => {
      expect(
        await fs.exists(path.join(config.cwd, 'node_modules', 'example-yarn-workspace-1', 'package.json')),
      ).toBeTruthy();
    },
  );
});

test.concurrent(
  'focus does not install transitive devdependencies shallowly (but does install non-transitive devdeps)',
  (): Promise<void> => {
    return runInstall(
      {focus: true},
      {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-6'},
      async (config, reporter) => {
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'example-yarn-workspace-5'))).toBeTruthy();
        expect(
          await fs.exists(
            path.join(
              config.cwd,
              'node_modules',
              'example-yarn-workspace-5',
              'node_modules',
              'example-yarn-workspace-2',
            ),
          ),
        ).toBeFalsy();
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2'))).toBeFalsy();
      },
    );
  },
);

test.concurrent(
  'focus does not shallowly install current version of sibling if another version is specified in package.json',
  (): Promise<void> => {
    return runInstall(
      {focus: true},
      {source: 'focus-different-versions', cwd: '/packages/example-yarn-workspace-1'},
      async (config, reporter) => {
        const packageFile = await fs.readFile(
          path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2', 'package.json'),
        );
        expect(JSON.parse(packageFile).version).toEqual('1.0.1');
      },
    );
  },
);

test.concurrent('focus works correctly when focusing on a scoped package', (): Promise<void> => {
  return runInstall({focus: true}, {source: 'focus-scoped', cwd: '/packages/scoped'}, async (config, reporter) => {
    const packageFile = await fs.readFile(
      path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2', 'package.json'),
    );
    expect(JSON.parse(packageFile).version).toEqual('1.1.1');
  });
});

describe('nohoist', () => {
  test.concurrent('focus installs nohoist dependencies shallowly', (): Promise<void> => {
    return runInstall(
      {focus: true},
      {source: 'focus-nohoist', cwd: '/packages/example-yarn-workspace-1'},
      async (config, reporter) => {
        const moduleDir = path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2');
        expect(await fs.exists(path.join(moduleDir, 'package.json'))).toBeTruthy();
        const stat = await fs.lstat(moduleDir);
        expect(stat.isSymbolicLink()).toEqual(false);
      },
    );
  });

  test.concurrent('focus does not do nested shallow installs of transitive nohoist packages', (): Promise<void> => {
    return runInstall(
      {focus: true},
      {source: 'focus-nohoist', cwd: '/packages/example-yarn-workspace-3'},
      async (config, reporter) => {
        const moduleDir = path.join(
          config.cwd,
          'node_modules',
          'example-yarn-workspace-1',
          'node_modules',
          'example-yarn-workspace-2',
        );
        expect(await fs.exists(path.join(moduleDir, 'package.json'))).toBeFalsy();
      },
    );
  });

  test.concurrent(
    'focus installs the correct version when a package is nohoist but differs from the workspace version',
    (): Promise<void> => {
      return runInstall(
        {focus: true},
        {source: 'focus-nohoist-different-versions', cwd: '/packages/example-yarn-workspace-6'},
        async (config, reporter) => {
          const packageFile = await fs.readFile(
            path.join(config.cwd, 'node_modules', 'example-yarn-workspace-2', 'package.json'),
          );
          expect(JSON.parse(packageFile).version).toEqual('1.0.0');
        },
      );
    },
  );
});
