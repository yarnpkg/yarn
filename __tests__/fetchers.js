/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */
/* eslint max-len: 0 */

import TarballFetcher from '../src/fetchers/tarball-fetcher.js';
import BaseFetcher from '../src/fetchers/base-fetcher.js';
import CopyFetcher from '../src/fetchers/copy-fetcher.js';
import GitFetcher from '../src/fetchers/git-fetcher.js';
import {NoopReporter} from '../src/reporters/index.js';
import Config from '../src/config.js';
import mkdir from './_temp.js';
import * as fs from '../src/util/fs.js';

let path = require('path');

async function createConfig(): Promise<Config> {
  let config = new Config(new NoopReporter());
  await config.init();
  return config;
}

test('BaseFetcher.fetch', async () => {
  let dir = await mkdir('base-fetcher');
  let fetcher = new BaseFetcher(dir, {
    type: 'base',
    registry: 'npm',
    reference: '',
  }, await createConfig());
  let error;

  try {
    await fetcher.fetch();
  } catch (e) {
    error = e;
  }
  expect(error && error.message).toBe('Not implemented');
});

test('CopyFetcher.fetch', async () => {
  let a = await mkdir('copy-fetcher-a');
  await fs.writeFile(path.join(a, 'package.json'), '{}');
  await fs.writeFile(path.join(a, 'foo'), 'bar');

  let b = await mkdir('copy-fetcher-b');
  let fetcher = new CopyFetcher(b, {
    type: 'copy',
    reference: a,
    registry: 'npm',
  }, await createConfig());
  await fetcher.fetch();
  const content = await fs.readFile(path.join(b, 'package.json'));
  expect(content).toBe('{}');
  const contentFoo = await fs.readFile(path.join(b, 'foo'));
  expect(contentFoo).toBe('bar');
});

test('[network] GitFetcher.fetch', async () => {
  let dir = await mkdir('git-fetcher');
  let fetcher = new GitFetcher(dir, {
    type: 'git',
    reference: 'https://github.com/PolymerElements/font-roboto',
    hash: '2fd5c7bd715a24fb5b250298a140a3ba1b71fe46',
    registry: 'bower',
  }, await createConfig());
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'bower.json'))).name;
  expect(name).toBe('font-roboto');
});

test('[network] TarballFetcher.fetch', async () => {
  let dir = await mkdir('tarball-fetcher');
  let fetcher = new TarballFetcher(dir, {
    type: 'tarball',
    hash: '9689b3b48d63ff70f170a192bec3c01b04f58f45',
    reference: 'https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz',
    registry: 'bower',
  }, await createConfig());


  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'bower.json'))).name;
  expect(name).toBe('font-roboto');
});

test('[network] TarballFetcher.fetch throws', async () => {
  let dir = await mkdir('tarball-fetcher');
  let url = 'https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz';
  let fetcher = new TarballFetcher(dir, {
    type: 'tarball',
    hash: 'foo',
    reference: url,
    registry: 'bower',
  }, await createConfig());
  let error;
  try {
    await fetcher.fetch();
  } catch (e) {
    error = e;
  }
  expect(error && error.message).toMatchSnapshot();
});
