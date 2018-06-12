/* @flow */

jest.mock('../../src/util/execute-lifecycle-script');
jest.mock('../../src/util/git/git-spawn');

import {run as buildRun} from './_helpers.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {run} from '../../src/cli/commands/version.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const execCommand: $FlowFixMe = require('../../src/util/execute-lifecycle-script').execCommand;
const spawn: $FlowFixMe = require('../../src/util/git/git-spawn').spawn;

spawn.mockReturnValue(Promise.resolve(''));

const path = require('path');

beforeEach(() => {
  execCommand.mockClear();
  spawn.mockClear();
});

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'version');
const runRun = buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  return run(config, reporter, flags, args);
});

const oldVersion = '1.0.0';
const newVersion = '2.0.0';

const gitTagVersion = true;

test('run version with no arguments and --new-version flag', (): Promise<void> => {
  return runRun([], {newVersion, gitTagVersion}, 'no-args', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({stdout: null, stdin: null});

    // Emulate run output
    rprtr.info(`${rprtr.lang('currentVersion')}: ${oldVersion}`);
    rprtr.info(`${rprtr.lang('newVersion')}: ${newVersion}`);

    expect(reporter.getBuffer()).toEqual(rprtr.getBuffer());
  });
});

test('run version with no arguments, --new-version flag where version is same as pkg.version', (): Promise<void> => {
  return runRun([], {newVersion, gitTagVersion}, 'no-args-same-version', async (config, reporter): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(pkg.version).toEqual(newVersion);
  });
});

test('run version with --non-interactive and --new-version should succeed', (): Promise<void> => {
  return runRun([], {nonInteractive: true, newVersion}, 'no-args', async (config, reporter): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(pkg.version).toEqual(newVersion);
  });
});

test('run version with --non-interactive and without --new-version should succeed', (): Promise<void> => {
  return runRun([], {nonInteractive: true}, 'no-args', async (config, reporter): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    expect(pkg.version).toEqual(oldVersion);
  });
});

test('run version and make sure all lifecycle steps are executed', (): Promise<void> => {
  return runRun([], {newVersion, gitTagVersion}, 'no-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    const preversionLifecycle = {
      stage: 'preversion',
      config,
      cmd: pkg.scripts.preversion,
      cwd: config.cwd,
      isInteractive: true,
    };
    const versionLifecycle = {
      stage: 'version',
      config,
      cmd: pkg.scripts.version,
      cwd: config.cwd,
      isInteractive: true,
    };
    const postversionLifecycle = {
      stage: 'postversion',
      config,
      cmd: pkg.scripts.postversion,
      cwd: config.cwd,
      isInteractive: true,
    };

    expect(execCommand.mock.calls.length).toBe(3);

    expect(execCommand.mock.calls[0]).toEqual([preversionLifecycle]);
    expect(execCommand.mock.calls[1]).toEqual([versionLifecycle]);
    expect(execCommand.mock.calls[2]).toEqual([postversionLifecycle]);
  });
});

test('run version and make sure only the defined lifecycle steps are executed', (): Promise<void> => {
  return runRun([], {newVersion, gitTagVersion}, 'pre-post', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    const preversionLifecycle = {
      stage: 'preversion',
      config,
      cmd: pkg.scripts.preversion,
      cwd: config.cwd,
      isInteractive: true,
    };
    const postversionLifecycle = {
      stage: 'postversion',
      config,
      cmd: pkg.scripts.postversion,
      cwd: config.cwd,
      isInteractive: true,
    };

    expect(execCommand.mock.calls.length).toBe(2);

    expect(execCommand.mock.calls[0]).toEqual([preversionLifecycle]);
    expect(execCommand.mock.calls[1]).toEqual([postversionLifecycle]);
  });
});

test('run version and make sure git commit hooks are enabled by default', async (): Promise<void> => {
  const fixture = 'no-args';
  await fs.mkdirp(path.join(fixturesLoc, fixture, '.git'));

  return runRun([], {newVersion, gitTagVersion}, fixture, (): ?Promise<void> => {
    const gitArgs = ['commit', '-m', 'v2.0.0'];
    expect(spawn.mock.calls.length).toBe(4);
    expect(spawn.mock.calls[2][0]).toEqual(gitArgs);
  });
});

test('run version with --no-commit-hooks and make sure git commit hooks are disabled', async (): Promise<void> => {
  const fixture = 'no-args';
  await fs.mkdirp(path.join(fixturesLoc, fixture, '.git'));

  return runRun([], {newVersion, gitTagVersion, commitHooks: false}, fixture, (): ?Promise<void> => {
    const gitArgs = ['commit', '-m', 'v2.0.0', '-n'];
    expect(spawn.mock.calls.length).toBe(4);
    expect(spawn.mock.calls[2][0]).toEqual(gitArgs);
  });
});

test('run version and make sure commit hooks are disabled by config', async (): Promise<void> => {
  const fixture = 'no-args-no-git-hooks';
  await fs.mkdirp(path.join(fixturesLoc, fixture, '.git'));

  return runRun([], {newVersion, gitTagVersion}, fixture, (): ?Promise<void> => {
    const gitArgs = ['commit', '-m', 'v2.0.0', '-n'];
    expect(spawn.mock.calls.length).toBe(4);
    expect(spawn.mock.calls[2][0]).toEqual(gitArgs);
  });
});

test('run version with --major flag and make sure major version is incremented', (): Promise<void> => {
  return runRun([], {gitTagVersion, major: true}, 'no-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    expect(pkg.version).toEqual('2.0.0');
  });
});

test('run version with --minor flag and make sure minor version is incremented', (): Promise<void> => {
  return runRun([], {gitTagVersion, minor: true}, 'no-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    expect(pkg.version).toEqual('1.1.0');
  });
});

test('run version with --patch flag and make sure patch version is incremented', (): Promise<void> => {
  return runRun([], {gitTagVersion, patch: true}, 'no-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    expect(pkg.version).toEqual('1.0.1');
  });
});
