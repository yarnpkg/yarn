/* @flow */

jest.mock('../../src/util/execute-lifecycle-script', () => {
  return {
    // $FlowFixMe
    ...require.requireActual('../../src/util/execute-lifecycle-script'),
    execCommand: jest.fn(),
  };
});

import path from 'path';

import {run as buildRun} from './_helpers.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {run} from '../../src/cli/commands/run.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const {execCommand}: $FlowFixMe = require('../../src/util/execute-lifecycle-script');

beforeEach(() => execCommand.mockClear());

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'run');
const runRun = buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  return run(config, reporter, flags, args);
});
const runRunInWorkspacePackage = function(cwd, ...args): Promise<void> {
  return buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
    const originalCwd = config.cwd;
    config.cwd = path.join(originalCwd, cwd);
    const retVal = run(config, reporter, flags, args);
    retVal.then(() => {
      config.cwd = originalCwd;
    });
    return retVal;
  })(...args);
};
const runRunWithCustomShell = function(customShell, ...args): Promise<void> {
  return buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
    const yarnRegistry = config.registries.yarn;
    const originalCustomShell = yarnRegistry.config['script-shell'];
    yarnRegistry.config['script-shell'] = customShell;
    const retVal = run(config, reporter, flags, args);
    retVal.then(() => {
      yarnRegistry.config['script-shell'] = originalCustomShell;
    });
    return retVal;
  })(...args);
};

test('lists all available commands with no arguments', (): Promise<void> =>
  runRun([], {}, 'no-args', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({stdout: null, stdin: null});
    const scripts = ['build', 'prestart', 'start'];
    const hints = {
      build: "echo 'building'",
      prestart: "echo 'prestart'",
      start: 'node index.js',
    };
    const bins = ['cat-names'];

    // Emulate run output
    rprtr.info(`${rprtr.lang('binCommands')}${bins.join(', ')}`);
    rprtr.info(rprtr.lang('possibleCommands'));
    rprtr.list('possibleCommands', scripts, hints);
    rprtr.error(rprtr.lang('commandNotSpecified'));

    expect(reporter.getBuffer()).toEqual(rprtr.getBuffer());
  }));

test('lists all available commands with no arguments and --non-interactive', (): Promise<void> =>
  runRun([], {nonInteractive: true}, 'no-args', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({stdout: null, stdin: null});
    const scripts = ['build', 'prestart', 'start'];
    const hints = {
      build: "echo 'building'",
      prestart: "echo 'prestart'",
      start: 'node index.js',
    };
    const bins = ['cat-names'];

    // Emulate run output
    rprtr.info(`${rprtr.lang('binCommands')}${bins.join(', ')}`);
    rprtr.info(rprtr.lang('possibleCommands'));
    rprtr.list('possibleCommands', scripts, hints);

    expect(reporter.getBuffer()).toEqual(rprtr.getBuffer());
  }));

test('runs script containing spaces', (): Promise<void> =>
  runRun(['build'], {}, 'spaces', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    // The command gets called with a space appended
    expect(execCommand).toBeCalledWith({
      stage: 'build',
      config,
      cmd: pkg.scripts.build,
      cwd: config.cwd,
      isInteractive: true,
    });
  }));

test('properly handles extra arguments and pre/post scripts', (): Promise<void> =>
  runRun(['start', '--hello'], {}, 'extra-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const poststart = {stage: 'poststart', config, cmd: pkg.scripts.poststart, cwd: config.cwd, isInteractive: true};
    const prestart = {stage: 'prestart', config, cmd: pkg.scripts.prestart, cwd: config.cwd, isInteractive: true};
    const start = {stage: 'start', config, cmd: pkg.scripts.start + ' --hello', cwd: config.cwd, isInteractive: true};

    expect(execCommand.mock.calls[0]).toEqual([prestart]);
    expect(execCommand.mock.calls[1]).toEqual([start]);
    expect(execCommand.mock.calls[2]).toEqual([poststart]);
  }));

test('properly handle bin scripts', (): Promise<void> =>
  runRun(['cat-names'], {}, 'bin', config => {
    const script = path.join(config.cwd, 'node_modules', '.bin', 'cat-names');

    expect(execCommand).toBeCalledWith({
      stage: 'cat-names',
      config,
      cmd: script,
      cwd: config.cwd,
      isInteractive: true,
    });
  }));

test('properly handle env command', (): Promise<void> =>
  runRun(['env'], {}, 'no-args', (config, reporter): ?Promise<void> => {
    // $FlowFixMe
    const result = JSON.parse(reporter.getBuffer()[0].data);

    const env = {};
    let pathVarName = 'PATH';
    for (const key of Object.keys(process.env)) {
      // Filter out yarn-added `npm_` variables since we run tests through yarn already
      if (key.startsWith('npm_')) {
        continue;
      }
      // We need this below for Windows which has case-insensitive env vars
      // If we used `process.env` directly, node takes care of this for us,
      // but since we use a subset of it, we need to get the "real" path key
      // name for Jest's case-sensitive object comparison below.
      if (key.toUpperCase() === 'PATH') {
        pathVarName = key;
      }
      env[key] = process.env[key];
    }

    result[pathVarName] = result[pathVarName] ? result[pathVarName].split(path.delimiter) : [];
    // $FlowFixMe
    env[pathVarName] = env[pathVarName] ? expect.arrayContaining(env[pathVarName].split(path.delimiter)) : [];

    expect(result).toMatchObject(env);
    expect(result).toHaveProperty('npm_lifecycle_event');
    expect(result).toHaveProperty('npm_execpath');
    expect(result).toHaveProperty('npm_node_execpath');
  }));

test('adds string delimiters if args have spaces', (): Promise<void> =>
  runRun(['cat-names', '--filter', 'cat names'], {}, 'bin', config => {
    const script = path.join(config.cwd, 'node_modules', '.bin', 'cat-names');
    const q = process.platform === 'win32' ? '"' : "'";

    expect(execCommand).toBeCalledWith({
      stage: 'cat-names',
      config,
      cmd: `${script} --filter ${q}cat names${q}`,
      cwd: config.cwd,
      isInteractive: true,
    });
  }));

test('adds quotes if args have spaces and quotes', (): Promise<void> =>
  runRun(['cat-names', '--filter', '"cat names"'], {}, 'bin', config => {
    const script = path.join(config.cwd, 'node_modules', '.bin', 'cat-names');
    const quotedCatNames = process.platform === 'win32' ? '^"\\^"cat^ names\\^"^"' : `'"cat names"'`;

    expect(execCommand).toBeCalledWith({
      stage: 'cat-names',
      config,
      cmd: `${script} --filter ${quotedCatNames}`,
      cwd: config.cwd,
      isInteractive: true,
    });
  }));

test('returns noScriptsAvailable with no scripts', (): Promise<void> =>
  runRun([], {}, 'no-scripts', (config, reporter) => {
    expect(reporter.getBuffer()).toMatchSnapshot();
  }));

test('returns noBinAvailable with no bins', (): Promise<void> =>
  runRun([], {}, 'no-bin', (config, reporter) => {
    expect(reporter.getBuffer()).toMatchSnapshot();
  }));

test('adds workspace root node_modules/.bin to path when in a workspace', (): Promise<void> =>
  runRunInWorkspacePackage('packages/pkg1', ['env'], {}, 'workspace', (config, reporter): ?Promise<void> => {
    const logEntry = reporter.getBuffer().find(entry => entry.type === 'log');
    const parsedLogData = JSON.parse(logEntry ? logEntry.data.toString() : '{}');
    const envPaths = (parsedLogData.PATH || parsedLogData.Path).split(path.delimiter);

    expect(envPaths).toContain(path.join(config.cwd, 'node_modules', '.bin'));
    expect(envPaths).toContain(path.join(config.cwd, 'packages', 'pkg1', 'node_modules', '.bin'));
  }));

test('runs script with custom script-shell', (): Promise<void> =>
  runRunWithCustomShell('/usr/bin/dummy', ['start'], {}, 'script-shell', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    // The command gets called with the provided customShell
    expect(execCommand).toBeCalledWith({
      stage: 'start',
      config,
      cmd: pkg.scripts.start,
      cwd: config.cwd,
      isInteractive: true,
      customShell: '/usr/bin/dummy',
    });
  }));
