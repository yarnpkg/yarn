/* @flow */

import {JSONReporter, BufferReporter} from '../../src/reporters/index.js';
import * as fs from '../../src/util/fs.js';
import {run} from '../../src/cli/commands/cache.js';
import {run as buildRun, runInstall} from './_helpers.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'cache');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const runCache = buildRun.bind(
  null,
  JSONReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    await run(config, reporter, flags, args);
    return getStdout();
  },
);

test('list', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {}, ['list']);
    const stdout = reporter.getBufferText();
    expect(stdout).toContain('dummy');
    expect(stdout).toContain('0.0.0');
  });
});

test('list skips corrupted package', async (): Promise<void> => {
  await runCache(['list'], {}, 'corrupted', (config, reporter, stdout) => {
    expect(stdout).not.toContain(JSON.stringify('corrupted'));
    expect(stdout).toContain(JSON.stringify('good-module'));
  });
});

test('ls with scoped packages', async (): Promise<void> => {
  await runInstall({}, 'install-from-authed-private-registry', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {}, ['list']);
    const stdout = reporter.getBufferText();
    expect(stdout).toContain('@types/lodash');
    expect(stdout).toContain('4.14.37');
  });
});

test('ls with filter that matches cache', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {pattern: 'dummy'}, ['list']);
    const stdout = reporter.getBufferText();
    expect(stdout).toContain('dummy');
    expect(stdout).toContain('0.0.0');
  });
});

test('ls with filter that matches cache with wildcard', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {pattern: 'dum*'}, ['list']);
    const stdout = reporter.getBufferText();
    expect(stdout).toContain('dummy');
    expect(stdout).toContain('0.0.0');
  });
});

test('ls with multiple patterns, one matching', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {pattern: 'dum|dummy'}, ['list']);
    const stdout = reporter.getBufferText();
    expect(stdout).toContain('dummy');
    expect(stdout).toContain('0.0.0');
  });
});

test('ls with pattern that only partially matches', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {pattern: 'dum'}, ['list']);
    const stdout = reporter.getBufferText();
    expect(stdout).toContain('dummy');
    expect(stdout).toContain('0.0.0');
  });
});

test('ls with filter that does not match', async (): Promise<void> => {
  await runInstall({}, 'artifacts-finds-and-saves', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {pattern: 'noMatch'}, ['list']);
    const stdout = reporter.getBufferText();
    expect(stdout).not.toContain('dummy');
    expect(stdout).not.toContain('0.0.0');
  });
});

test('ls filter by pattern with scoped package', async (): Promise<void> => {
  await runInstall({}, 'install-from-authed-private-registry', async (config): Promise<void> => {
    const reporter = new BufferReporter();
    await run(config, reporter, {pattern: '@types/*'}, ['list']);
    const stdout = reporter.getBufferText();
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

    const reporter = new BufferReporter();
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

    const reporter = new BufferReporter();

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

test('clean with multiple package names', async (): Promise<void> => {
  await runInstall({}, 'install-production', async (config): Promise<void> => {
    let files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(3);

    const reporter = new BufferReporter();

    await run(config, reporter, {}, ['clean', 'is-array', 'left-pad']);
    expect(await fs.exists(config.cacheFolder)).toBeTruthy();
    files = await fs.readdir(config.cacheFolder);
    expect(files.length).toEqual(1); // Only .tmp folder left
  });
});
