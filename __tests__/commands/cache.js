/* @flow */

import * as reporters from '../../src/reporters/index.js';
import * as fs from '../../src/util/fs.js';
import {run} from '../../src/cli/commands/cache.js';
import {getTempGlobalFolder, run as buildRun, runInstall} from './_helpers.js';

const os = require('os');
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

test('dir, override YARN_CACHE_FOLDER with config', async (): Promise<void> => {
  // The test harness sets cache folder config by default
  await runCache(['dir'], {}, '', (config, reporter, stdout) => {
    expect(stdout).toContain(JSON.stringify(config.cacheFolder));
  });
});

test('dir defaults to YARN_CACHE_FOLDER env var', async (): Promise<void> => {
  const envCacheFolder = process.env.YARN_CACHE_FOLDER;
  const tempFolder = getTempGlobalFolder();
  process.env.YARN_CACHE_FOLDER = tempFolder;
  await runCache(['dir'], {noCache: true}, '', (config, reporter, stdout) => {

    expect(stdout).toContain(tempFolder);
    // restore env
    process.env.YARN_CACHE_FOLDER = envCacheFolder;
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
