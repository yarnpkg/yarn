/* @flow */

import {run as check} from '../../../src/cli/commands/check.js';
import {Install} from '../../../src/cli/commands/install.js';
import * as reporters from '../../../src/reporters/index.js';
import * as fs from '../../../src/util/fs.js';
import {runInstall, run as buildRun} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');

test.concurrent("workspaces don't work without a configuration in .yarnrc", async (): Promise<void> => {
  let error = '';
  const reporter = new reporters.ConsoleReporter({});
  try {
    await runInstall({}, 'workspaces-install-enabled');
  } catch (e) {
    error = e.message;
  }
  expect(error).toContain(reporter.lang('workspaceExperimentalDisabled'));
});

test.concurrent("workspaces don't work on non private projects", async (): Promise<void> => {
  let error = '';
  const reporter = new reporters.ConsoleReporter({});
  try {
    await runInstall({}, 'workspaces-install-private');
  } catch (e) {
    error = e.message;
  }
  expect(error).toContain(reporter.lang('workspacesRequirePrivateProjects'));
});

test.concurrent("workspaces don't work with duplicate names", async (): Promise<void> => {
  let error = '';
  const reporter = new reporters.ConsoleReporter({});
  try {
    await runInstall({}, 'workspaces-install-duplicate');
  } catch (e) {
    error = e.message;
  }
  expect(error).toContain(reporter.lang('workspaceNameDuplicate', 'workspace-1'));
});

test.concurrent("workspaces warn and get ignored if they don't have a name and a version", (): Promise<void> => {
  return buildRun(
    reporters.BufferReporter,
    path.join(__dirname, '..', '..', 'fixtures', 'install'),
    async (args, flags, config, reporter, lockfile): Promise<void> => {
      const install = new Install(flags, config, reporter, lockfile);
      await install.init();
      const warnings = reporter.getBuffer();
      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().includes('missing version in workspace');
        }),
      ).toEqual(true);
      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().includes('missing name in workspace');
        }),
      ).toEqual(true);
    },
    [],
    {},
    'workspaces-install-mandatory-fields',
  );
});

test.concurrent('installs workspaces dependencies into root folder', (): Promise<void> => {
  return runInstall({}, 'workspaces-install-basic', async (config): Promise<void> => {
    const lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    expect(lockfile.indexOf('isarray')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('repeat-string')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('left-pad')).toBeGreaterThanOrEqual(0);
    expect(lockfile.indexOf('right-pad')).toBeGreaterThanOrEqual(0);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'isarray'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'repeat-string'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'right-pad'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'workspace-child', 'node_modules'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'workspace-child', 'yarn.lock'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-2', 'node_modules'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-2', 'yarn.lock'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-3', 'node_modules'))).toBe(false);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-child-3', 'yarn.lock'))).toBe(false);
  });
});

test.concurrent('install should install unhoistable dependencies in workspace node_modules', (): Promise<void> => {
  return runInstall({}, 'workspaces-install-conflict', async (config): Promise<void> => {
    // node_modules/left-pad@1.1.3
    let packageFile = await fs.readFile(path.join(config.cwd, 'node_modules', 'left-pad', 'package.json'));
    expect(JSON.parse(packageFile).version).toEqual('1.1.3');

    // node_modules/workspace-child/left-pad@1.1.1
    packageFile = await fs.readFile(
      path.join(config.cwd, 'workspace-child', 'node_modules', 'left-pad', 'package.json'),
    );
    expect(JSON.parse(packageFile).version).toEqual('1.1.1');
  });
});

test.concurrent('install should link workspaces that refer each other', (): Promise<void> => {
  return runInstall({}, 'workspaces-install-link', async (config): Promise<void> => {
    // packages/workspace-1/node_modules/left-pad - missing because it is hoisted to the root
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-1', 'node_modules'))).toBe(false);

    // node_modules/left-pad - link
    const packageFile = await fs.readFile(path.join(config.cwd, 'node_modules', 'left-pad', 'package.json'));
    expect(JSON.parse(packageFile).version).toEqual('1.1.2');
    const readme = await fs.readFile(path.join(config.cwd, 'node_modules', 'left-pad', 'README.md'));
    expect(readme.split('\n')[0]).toEqual('WORKSPACES ROCK!');
  });
});

test.concurrent(
  'install should not link workspaces that refer not compatible version of another workspace',
  (): Promise<void> => {
    return runInstall({}, 'workspaces-install-link', async (config): Promise<void> => {
      // packages/workspace-2/node_modules/left-pad - from npm
      const packageFile = await fs.readFile(
        path.join(config.cwd, 'packages', 'workspace-2', 'node_modules', 'left-pad', 'package.json'),
      );
      const readme = await fs.readFile(
        path.join(config.cwd, 'packages', 'workspace-2', 'node_modules', 'left-pad', 'README.md'),
      );
      expect(JSON.parse(packageFile).version).not.toBe('1.1.2');
      expect(readme.split('\n')[0]).not.toEqual('WORKSPACES ROCK!');
    });
  },
);

test.concurrent('install should prioritize non workspace dependency at root over the workspace symlink', (): Promise<
  void,
> => {
  return runInstall({}, 'workspaces-install-link-root', async (config): Promise<void> => {
    // node_modules/left-pad - from npm
    let packageFile = await fs.readFile(path.join(config.cwd, 'node_modules', 'left-pad', 'package.json'));
    expect(JSON.parse(packageFile).version).toEqual('1.1.3');
    let readme = await fs.readFile(path.join(config.cwd, 'node_modules', 'left-pad', 'README.md'));
    expect(readme.split('\n')[0]).not.toEqual('WORKSPACES ROCK!');

    // node_modules/workspace-1/left-pad - link
    packageFile = await fs.readFile(
      path.join(config.cwd, 'packages', 'workspace-1', 'node_modules', 'left-pad', 'package.json'),
    );
    expect(JSON.parse(packageFile).version).toEqual('1.1.2');
    readme = await fs.readFile(
      path.join(config.cwd, 'packages', 'workspace-1', 'node_modules', 'left-pad', 'README.md'),
    );
    expect(readme.split('\n')[0]).toEqual('WORKSPACES ROCK!');

    // packages/workspace-2/node_modules/left-pad - missing because it is hoisted to the root
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-2', 'node_modules'))).toBe(false);
  });
});

test.concurrent('install should install subedependencies of workspaces', (): Promise<void> => {
  // the tricky part is that isarray is a subdependency of left-pad that is not referenced in the root
  // but another workspace
  return runInstall({}, 'workspaces-install-subdeps', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'isarray'))).toBe(true);
  });
});

test.concurrent(
  'install should install subedependencies of workspaces that are not referenced in other workspaces',
  (): Promise<void> => {
    // the tricky part is that left-pad is not a dependency of root
    return runInstall({}, 'workspaces-install-subdeps-2', async (config): Promise<void> => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'isarray'))).toBe(true);
    });
  },
);

test.concurrent('install should install dev dependencies of workspaces', (): Promise<void> => {
  // the tricky part is that left-pad is not a dependency of root
  return runInstall({}, 'workspaces-install-subdeps-dev', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-1', 'node_modules', 'left-pad'))).toBe(true);
  });
});

test.concurrent('install should not install dev dependencies of workspaces in production mode', (): Promise<void> => {
  // the tricky part is that left-pad is not a dependency of root
  return runInstall({production: true}, 'workspaces-install-subdeps-dev', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'workspace-1', 'node_modules', 'left-pad'))).toBe(false);
  });
});

// https://github.com/yarnpkg/yarn/issues/3598
test.concurrent('install should work correctly for workspaces that have similar names', (): Promise<void> => {
  return runInstall({production: true}, 'workspaces-install-names-issue', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'packages', 'jest', 'package.json'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'packages', 'jest-cli', 'package.json'))).toBe(true);
  });
});

test.concurrent('check command should work', (): Promise<void> => {
  return runInstall({checkFiles: true}, 'workspaces-install-basic', async (config, reporter): Promise<void> => {
    // check command + integrity check
    let thrown = false;
    try {
      await check(config, reporter, {integrity: true, checkFiles: true}, []);
      await check(config, reporter, {}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toBe(false);
  });
});

// TODO need more thorough tests for all kinds of checks: integrity, verify-tree
