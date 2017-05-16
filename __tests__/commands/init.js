/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {getGitConfigInfo, run as runInit} from '../../src/cli/commands/init.js';
import * as fs from '../../src/util/fs.js';

const path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'init');
const execInit = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter, lockfile): Promise<void> => {
    return runInit(config, reporter, flags, args);
  },
  [],
);

test.concurrent('init --yes should create package.json with defaults', (): Promise<void> => {
  return execInit({yes: true}, 'init-yes', async (config): Promise<void> => {
    const {cwd} = config;
    const manifestFile = await fs.readFile(path.join(cwd, 'package.json'));
    const manifest = JSON.parse(manifestFile);

    expect(manifest.name).toEqual(path.basename(cwd));
    expect(manifest.main).toEqual('index.js');
    expect(manifest.version).toEqual(String(config.getOption('init-version')));
    expect(manifest.license).toEqual(String(config.getOption('init-license')));
  });
});

test.concurrent('getGitConfigInfo should not return the git config val', async (): Promise<void> => {
  expect('hi seb').toEqual(await getGitConfigInfo('some-info', () => Promise.resolve('hi seb')));
});

test.concurrent('getGitConfigInfo should not fail when git fails', async (): Promise<void> => {
  expect('').toEqual(await getGitConfigInfo('some-info', () => Promise.reject(Error())));
});
