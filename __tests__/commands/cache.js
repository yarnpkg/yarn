/* @flow */

import * as reporters from '../../src/reporters/index.js';
import * as fs from '../../src/util/fs.js';
import {run} from '../../src/cli/commands/cache.js';
import {run as buildRun, runInstall} from './_helpers.js';

const path = require('path');
const stream = require('stream');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'cache');

const runCache = buildRun.bind(
  null,
  reporters.JSONReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    await run(config, reporter, flags, args);
    return getStdout();
  },
);

test('ls', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const out = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: out});
    await run(config, reporter, {}, ['ls']);
    const stdout = String(out.read());
    expect(stdout).toContain('dummy');
    expect(stdout).toContain('0.0.0');
  });
});

test('ls with scoped package', async (): Promise<void> => {
  await runInstall({}, 'install-from-authed-private-registry', async (config): Promise<void> => {
    const out = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: out});
    await run(config, reporter, {}, ['ls']);
    const stdout = String(out.read());
    expect(stdout).toContain('@types/lodash');
    expect(stdout).toContain('4.14.37');
  });
});

test('dir', async (): Promise<void> => {
  await runCache(['dir'], {}, '', (config, reporter, stdout) => {
    expect(stdout).toContain(JSON.stringify(config.cacheFolder));
  });
});

test('clean', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    let files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(2); // we need to add one .tmp folder

    const out = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: out});
    await run(config, reporter, {}, ['clean']);

    expect(await fs.exists(config.cacheFolder)).toBeTruthy();

    files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(0);
  });
});
