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

test('lists all available commands with no arguments', (): Promise<void> => {
  return runRun([], {}, 'no-args', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({stdout: null, stdin: null});
    const scripts = ['build', 'prestart', 'start'];
    const hints = {
      build: "echo 'building'",
      prestart: "echo 'prestart'",
      start: 'node index.js',
    };
    const bins = ['cat-names'];

    // Emulate run output
    rprtr.error(rprtr.lang('commandNotSpecified'));
    rprtr.info(`${rprtr.lang('binCommands')}${bins.join(', ')}`);
    rprtr.info(rprtr.lang('possibleCommands'));
    rprtr.list('possibleCommands', scripts, hints);
    rprtr.error(rprtr.lang('commandNotSpecified'));

    expect(reporter.getBuffer()).toEqual(rprtr.getBuffer());
  });
});

test('runs script containing spaces', (): Promise<void> => {
  return runRun(['build'], {}, 'spaces', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    // The command get's called with a space appended
    const args = ['build', config, pkg.scripts.build, config.cwd];

    expect(execCommand).toBeCalledWith(...args);
  });
});

test('properly handles extra arguments and pre/post scripts', (): Promise<void> => {
  return runRun(['start', '--hello'], {}, 'extra-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const poststart = ['poststart', config, pkg.scripts.poststart, config.cwd];
    const prestart = ['prestart', config, pkg.scripts.prestart, config.cwd];
    const start = ['start', config, pkg.scripts.start + ' --hello', config.cwd];

    expect(execCommand.mock.calls[0]).toEqual(prestart);
    expect(execCommand.mock.calls[1]).toEqual(start);
    expect(execCommand.mock.calls[2]).toEqual(poststart);
  });
});

test('properly handle bin scripts', (): Promise<void> => {
  return runRun(['cat-names'], {}, 'bin', config => {
    const script = path.join(config.cwd, 'node_modules', '.bin', 'cat-names');
    const args = ['cat-names', config, script, config.cwd];

    expect(execCommand).toBeCalledWith(...args);
  });
});

test('properly handle env command', (): Promise<void> => {
  return runRun(['env'], {}, 'no-args', (config, reporter): ?Promise<void> => {
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
  });
});

test('adds string delimiters if args have spaces', (): Promise<void> => {
  return runRun(['cat-names', '--filter', 'cat names'], {}, 'bin', config => {
    const script = path.join(config.cwd, 'node_modules', '.bin', 'cat-names');
    const q = process.platform === 'win32' ? '"' : "'";
    const args = ['cat-names', config, `${script} --filter ${q}cat names${q}`, config.cwd];

    expect(execCommand).toBeCalledWith(...args);
  });
});

test('adds quotes if args have spaces and quotes', (): Promise<void> => {
  return runRun(['cat-names', '--filter', '"cat names"'], {}, 'bin', config => {
    const script = path.join(config.cwd, 'node_modules', '.bin', 'cat-names');
    const quotedCatNames = process.platform === 'win32' ? '^"\\^"cat^ names\\^"^"' : `'"cat names"'`;
    const args = ['cat-names', config, `${script} --filter ${quotedCatNames}`, config.cwd];

    expect(execCommand).toBeCalledWith(...args);
  });
});
