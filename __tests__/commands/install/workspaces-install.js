/* @flow */

import {run as check} from '../../../src/cli/commands/check.js';
import {Install, run as install} from '../../../src/cli/commands/install.js';
import * as reporters from '../../../src/reporters/index.js';
import * as fs from '../../../src/util/fs.js';
import type ConfigType from '../../../src/config.js';
import {runInstall, run as buildRun, makeConfigFromDirectory, isPackagePresent} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');

test.concurrent("workspaces don't work with disabled configuration in .yarnrc", async (): Promise<void> => {
  let error = '';
  const reporter = new reporters.ConsoleReporter({});
  try {
    await runInstall({}, 'workspaces-install-enabled');
  } catch (e) {
    error = e.message;
  }
  expect(error).toContain(reporter.lang('workspacesDisabled'));
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
          return warning.data.toString().toLowerCase().indexOf('missing version in workspace') > -1;
        }),
      ).toEqual(true);
      expect(
        warnings.some(warning => {
          return warning.data.toString().toLowerCase().indexOf('missing name in workspace') > -1;
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

test.concurrent('install should not link a workspace if the version is not compatible', (): Promise<void> => {
  return runInstall({binLinks: true}, 'workspaces-install-link-invalid', async (config): Promise<void> => {
    // node_modules/left-pad - from npm
    const packageFile = await fs.readFile(path.join(config.cwd, 'node_modules', 'left-pad', 'package.json'));
    const readme = await fs.readFile(path.join(config.cwd, 'node_modules', 'left-pad', 'README.md'));
    expect(JSON.parse(packageFile).version).not.toBe('1.1.2');
    expect(readme.split('\n')[0]).not.toEqual('WORKSPACES ROCK!');
  });
});

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

test.concurrent('install should install subdependencies of workspaces', (): Promise<void> => {
  // the tricky part is that isarray is a subdependency of left-pad that is not referenced in the root
  // but another workspace
  return runInstall({}, 'workspaces-install-subdeps', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'isarray'))).toBe(true);
  });
});

test.concurrent(
  'install should install subdependencies of workspaces that are not referenced in other workspaces',
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

test.concurrent('install should link binaries at root and in workspace dependents', (): Promise<void> => {
  return runInstall({binLinks: true}, 'workspaces-install-link-bin', async (config): Promise<void> => {
    // node_modules/.bin/workspace-1 - link
    expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'workspace-1'))).toBe(true);

    // packages/workspace-2/node_modules/.bin/workspace-1 - link
    expect(
      await fs.exists(path.join(config.cwd, 'packages', 'workspace-2', 'node_modules', '.bin', 'workspace-1')),
    ).toBe(true);
  });
});

test.concurrent('install should ignore node_modules in workspaces when used with **/*', (): Promise<void> => {
  return runInstall({}, 'workspaces-install-already-exists', async (config): Promise<void> => {
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'a'))).toBe(true);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'b'))).toBe(true);
  });
});

describe('install should ignore deep node_modules in workspaces', () => {
  test('without nohoist', (): Promise<void> => {
    return runInstall(
      {workspacesNohoistEnabled: false},
      'workspaces-install-already-exists-deep',
      async (config): Promise<void> => {
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'a'))).toBe(true);
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'b'))).toBe(true);
      },
    );
  });
  test('with nohoist', (): Promise<void> => {
    return runInstall(
      {workspacesNohoistEnabled: true},
      'workspaces-install-already-exists-deep',
      async (config): Promise<void> => {
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'a'))).toBe(true);
        expect(await fs.exists(path.join(config.cwd, 'node_modules', 'b'))).toBe(true);
      },
    );
  });
});

test.concurrent('install should link binaries properly when run from child workspace', async () => {
  await runInstall({binLinks: true}, 'workspaces-install-bin', async (config, reporter): Promise<void> => {
    // initial install
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/touch`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/workspace-1`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/workspace-1`)).toEqual(true);

    // reset package folders to simulate running 'install' from
    // child workspace _before_ running it in the root (this is not
    // possible to do without an initial install using the current
    // testing infrastructure)
    await fs.unlink(`${config.cwd}/node_modules`);
    await fs.unlink(`${config.cwd}/packages/workspace-1/node_modules`);
    await fs.unlink(`${config.cwd}/packages/workspace-2/node_modules`);

    // run "install" in child package
    const childConfig = await makeConfigFromDirectory(`${config.cwd}/packages/workspace-1`, reporter, {binLinks: true});
    await install(childConfig, reporter, {}, []);

    expect(await fs.exists(`${config.cwd}/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/touch`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/node_modules/.bin/workspace-1`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/rimraf`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/workspace-2/node_modules/.bin/workspace-1`)).toEqual(true);
  });
});

// TODO need more thorough tests for all kinds of checks: integrity, verify-tree

describe('nohoist', () => {
  async function checkPackage(config: ConfigType, path: string, shouldPresent: boolean): Promise<void> {
    const isPresent = await isPackagePresent(config, path);
    try {
      expect(isPresent).toEqual(shouldPresent);
    } catch (e) {
      throw new Error(`error: ${path} should ${shouldPresent ? '' : 'NOT'} exist`);
    }
  }

  test.concurrent('exclude packages by workspace', (): Promise<void> => {
    return runInstall({}, 'workspaces-install-nohoist-by-ws', async (config): Promise<void> => {
      const existingPackages = [
        'workspace-disable-a',
        'workspace-disable-all',
        'workspace-hoist-all',
        'workspace-disable-all/c',
        'workspace-disable-all/b',
        'workspace-disable-all/d',
        'workspace-disable-a/a',
        'workspace-disable-a/b',
        'workspace-disable-all/workspace-hoist-all',
        'b',
        'c',
        'd',
      ];
      const notExistingPackages = ['a', 'workspace-hoist-all/b', 'workspace-hoist-all/d'];

      for (const p of existingPackages) {
        await checkPackage(config, p, true);
      }
      for (const p of notExistingPackages) {
        await checkPackage(config, p, false);
      }
    });
  });

  test.concurrent('disable all hoist for every workspace', (): Promise<void> => {
    return runInstall({}, 'workspaces-install-nohoist-all-from-root', async config => {
      const existingPackages = [
        'workspace-disable-a',
        'workspace-disable-all',
        'workspace-hoist-all',
        'workspace-disable-all/c',
        'workspace-disable-all/b',
        'workspace-disable-all/d',
        'workspace-disable-a/a',
        'workspace-disable-a/b',
        'workspace-disable-a/d',
        'workspace-hoist-all/b',
        'workspace-hoist-all/d',
      ];
      const notExistingPackages = ['a', 'b', 'c', 'd'];

      for (const p of existingPackages) {
        await checkPackage(config, p, true);
      }
      for (const p of notExistingPackages) {
        await checkPackage(config, p, false);
      }
    });
  });
  test.concurrent('disable some hoist for every workspace', (): Promise<void> => {
    return runInstall({}, 'workspaces-install-nohoist-some-from-root', async config => {
      const existingPackages = [
        'workspace-disable-a',
        'workspace-disable-all',
        'workspace-hoist-all',
        'workspace-disable-all/c',
        'workspace-disable-all/b',
        'workspace-disable-all/d',
        'workspace-disable-a/a',
        'workspace-disable-a/b',
        'workspace-disable-a/d',
        'workspace-hoist-all/d',
        'c',
        'b',
      ];
      const notExistingPackages = ['a', 'd'];

      for (const p of existingPackages) {
        await checkPackage(config, p, true);
      }
      for (const p of notExistingPackages) {
        await checkPackage(config, p, false);
      }
    });
  });
  test.concurrent('disable hoisting package across versions', (): Promise<void> => {
    return runInstall({}, 'workspaces-install-nohoist-across-versions', async config => {
      const existingPackages = [
        'workspace-1',
        'workspace-2',
        'workspace-3',
        'workspace-1/c',
        'workspace-1/b',
        'workspace-1/a',
        'workspace-2/b',
        'workspace-2/c',
        'workspace-2/b',
        'workspace-2/c/b',
        'workspace-3/b',
        'd',
      ];
      const notExistingPackages = ['a', 'b', 'c', 'workspace-3/d'];

      for (const p of existingPackages) {
        await checkPackage(config, p, true);
      }
      for (const p of notExistingPackages) {
        await checkPackage(config, p, false);
      }
    });
  });
});
