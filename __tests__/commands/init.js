/* @flow */

import {runInit} from './_init.js';
import {DEFAULTS} from '../../src/registries/yarn-registry.js';
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
    assert.equal(manifest.version, DEFAULTS['init-version']);
    assert.equal(manifest.license, DEFAULTS['init-license']);
  });
});
