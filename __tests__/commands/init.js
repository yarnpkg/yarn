/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {getGitConfigInfo, run as runInit} from '../../src/cli/commands/init.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';

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

test.concurrent('init --yes should create package.json with defaults',  (): Promise<void> => {
  return execInit({yes: true}, 'init-yes', async (config): Promise<void> => {
    const {cwd} = config;
    const manifestFile = await fs.readFile(path.join(cwd, 'package.json'));
    const manifest = JSON.parse(manifestFile);

    assert.equal(manifest.name, path.basename(cwd));
    assert.equal(manifest.main, 'index.js');
    assert.equal(manifest.version, String(config.getOption('init-version')));
    assert.equal(manifest.license, String(config.getOption('init-license')));
  });
});

test.concurrent('getGitConfigInfo should not return the git config val', async (): Promise<void> => {
  assert.equal('hi seb', await getGitConfigInfo('some-info', () => Promise.resolve('hi seb')));
});

test.concurrent('getGitConfigInfo should not fail when git fails', async (): Promise<void> => {
  assert.equal('', await getGitConfigInfo('some-info', () => Promise.reject(Error())));
});
