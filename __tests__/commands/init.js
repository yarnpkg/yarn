/* @flow */

import {runInit} from './_init.js';
import {getGitConfigInfo} from '../../src/cli/commands/init.js';
import * as fs from '../../src/util/fs.js';
import assert from 'assert';

const path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

test.concurrent('init --yes should create package.json with defaults',  (): Promise<void> => {
  return runInit({yes: true}, 'init-yes', async (config): Promise<void> => {
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
