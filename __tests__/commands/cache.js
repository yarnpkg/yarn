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

test('list', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const out = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: out});
    await run(config, reporter, {}, ['list']);
    const stdout = String(out.read());
    expect(stdout).toContain('dummy');
    expect(stdout).toContain('0.0.0');
  });
});

test('ls with scoped package', async (): Promise<void> => {
  await runInstall({}, 'install-from-authed-private-registry', async (config): Promise<void> => {
    const out = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: out});
    await run(config, reporter, {}, ['list']);
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
    // Asserting cache size is 1...
    // we need to add one for the .tmp folder
    //
    // Per #2860, file: protocol installs may add the same package to the cache
    // multiple times if it is installed with a force flag or has an install script.
    // We'll add another for a total of 3 because this particular fixture has
    // an install script.
    expect(files.length).toEqual(3);

    const out = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: out});
    await run(config, reporter, {}, ['clean']);

    expect(await fs.exists(config.cacheFolder)).toBeTruthy();

    files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(0);
  });
});

test('clean with package name', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    let files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(3);

    const out = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: out});

    await run(config, reporter, {}, ['clean', 'unknownname']);
    expect(await fs.exists(config.cacheFolder)).toBeTruthy();
    files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(3); // Nothing deleted

    await run(config, reporter, {}, ['clean', 'dummy']);
    expect(await fs.exists(config.cacheFolder)).toBeTruthy();
    files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(1); // Only .tmp folder left
  });
});
