/* @flow */

jest.mock('../../src/util/execute-lifecycle-script');

import {BufferReporter} from '../../src/reporters/index.js';
import {run} from '../../src/cli/commands/run.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const execCommand: $FlowFixMe = require('../../src/util/execute-lifecycle-script').execCommand;

const stream = require('stream');
const path = require('path');
const os = require('os');

beforeEach(() => execCommand.mockClear());

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'run');

async function runRun(
  flags: Object,
  args: Array<string>,
  name: string,
  checkRun?: ?(config: Config, reporter: BufferReporter) => ?Promise<void>,
): Promise<void> {
  const dir = path.join(fixturesLoc, name);
  const cwd = path.join(
    os.tmpdir(),
    `yarn-${path.basename(dir)}-${Math.random()}`,
  );
  await fs.unlink(cwd);
  await fs.copy(dir, cwd);

  for (const {basename, absolute} of await fs.walk(cwd)) {
    if (basename.toLowerCase() === '.ds_store') {
      await fs.unlink(absolute);
    }
  }

  let out = '';
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  const reporter = new reporters.BufferReporter({stdout: null, stdin: null});

  // create directories
  await fs.mkdirp(path.join(cwd, '.yarn'));
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    const config = new Config(reporter);
    await config.init({
      cwd,
      globalFolder: path.join(cwd, '.yarn/.global'),
      cacheFolder: path.join(cwd, '.yarn'),
      linkFolder: path.join(cwd, '.yarn/.link'),
    });

    await run(config, reporter, flags, args);

    if (checkRun) {
      await checkRun(config, reporter);
    }

  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}

test('lists all available commands with no arguments', (): Promise<void> => {
  return runRun({}, [], 'no-args', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({stdout: null, stdin: null});
    const scripts = ['build', 'prestart', 'start'];
    // Notice `cat-names` is below twice as there is a bug with output duplication
    const bins = ['cat-names', 'cat-names'];

    // Emulate run output
    rprtr.error(rprtr.lang('commandNotSpecified'));
    rprtr.info(`${rprtr.lang('binCommands')}${bins.join(', ')}`);
    rprtr.info(rprtr.lang('possibleCommands'));
    rprtr.list('possibleCommands', scripts);
    rprtr.error(rprtr.lang('commandNotSpecified'));

    expect(reporter.getBuffer()).toEqual(rprtr.getBuffer());
  });
});

test('runs script containing spaces', (): Promise<void> => {
  return runRun({}, ['build'], 'spaces', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    // The command get's called with a space appended
    const args = ['build', config, pkg.scripts.build + ' ', config.cwd];

    expect(execCommand).toBeCalledWith(...args);
  });
});

test('properly handles extra arguments and pre/post scripts', (): Promise<void> => {
  return runRun({}, ['start', '--hello'], 'extra-args', async (config): ?Promise<void> => {
    const pkg = await fs.readJson(path.join(config.cwd, 'package.json'));
    const poststart = ['poststart', config, pkg.scripts.poststart, config.cwd];
    const prestart = ['prestart', config, pkg.scripts.prestart, config.cwd];
    const start = ['start', config, pkg.scripts.start + ' --hello', config.cwd];

    expect(execCommand.mock.calls[0]).toEqual(prestart);
    expect(execCommand.mock.calls[1]).toEqual(start);
    expect(execCommand.mock.calls[2]).toEqual(poststart);
  });
});

test('handles bin scripts', (): Promise<void> => {
  return runRun({}, ['cat-names'], 'bin', (config) => {
    const script = path.join(config.cwd, 'node_modules', '.bin', 'cat-names');
    const args = ['cat-names', config, `"${script}" `, config.cwd];

    expect(execCommand).toBeCalledWith(...args);
  });
});
