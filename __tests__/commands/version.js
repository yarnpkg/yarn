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

beforeEach(() => execCommand.mockClear());

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

test('run version and make sure all lifecycle steps are executed', (): Promise<void> => {
  return runRun([], {newVersion, gitTagVersion}, 'no-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    const preversionLifecycle = ['preversion', config, pkg.scripts.preversion, config.cwd];
    const versionLifecycle = ['version', config, pkg.scripts.version, config.cwd];
    const postversionLifecycle = ['postversion', config, pkg.scripts.postversion, config.cwd];

    expect(execCommand.mock.calls.length).toBe(3);

    expect(execCommand.mock.calls[0]).toEqual(preversionLifecycle);
    expect(execCommand.mock.calls[1]).toEqual(versionLifecycle);
    expect(execCommand.mock.calls[2]).toEqual(postversionLifecycle);
  });
});

test('run version and make sure only the defined lifecycle steps are executed', (): Promise<void> => {
  return runRun([], {newVersion, gitTagVersion}, 'pre-post', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));

    const preversionLifecycle = ['preversion', config, pkg.scripts.preversion, config.cwd];
    const postversionLifecycle = ['postversion', config, pkg.scripts.postversion, config.cwd];

    expect(execCommand.mock.calls.length).toBe(2);

    expect(execCommand.mock.calls[0]).toEqual(preversionLifecycle);
    expect(execCommand.mock.calls[1]).toEqual(postversionLifecycle);
  });
});
