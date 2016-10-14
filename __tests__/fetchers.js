/* @flow */
/* eslint max-len: 0 */

import TarballFetcher, {LocalTarballFetcher} from '../src/fetchers/tarball-fetcher.js';
import BaseFetcher from '../src/fetchers/base-fetcher.js';
import CopyFetcher from '../src/fetchers/copy-fetcher.js';
import GitFetcher from '../src/fetchers/git-fetcher.js';
import {NoopReporter} from '../src/reporters/index.js';
import Config from '../src/config.js';
import mkdir from './_temp.js';
import * as fs from '../src/util/fs.js';

const path = require('path');

async function createConfig(): Promise<Config> {
  const config = new Config(new NoopReporter());
  await config.init();
  return config;
}

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

test('BaseFetcher.fetch', async () => {
  const dir = await mkdir('base-fetcher');
  const fetcher = new BaseFetcher(dir, {
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
  const a = await mkdir('copy-fetcher-a');
  await fs.writeFile(path.join(a, 'package.json'), '{}');
  await fs.writeFile(path.join(a, 'foo'), 'bar');

  const b = await mkdir('copy-fetcher-b');
  const fetcher = new CopyFetcher(b, {
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

test('GitFetcher.fetch', async () => {
  const dir = await mkdir('git-fetcher');
  const fetcher = new GitFetcher(dir, {
    type: 'git',
    reference: 'https://github.com/PolymerElements/font-roboto',
    hash: '2fd5c7bd715a24fb5b250298a140a3ba1b71fe46',
    registry: 'bower',
  }, await createConfig());
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'bower.json'))).name;
  expect(name).toBe('font-roboto');
});

test('TarballFetcher.fetch', async () => {
  const dir = await mkdir('tarball-fetcher');
  const fetcher = new TarballFetcher(dir, {
    type: 'tarball',
    hash: '9689b3b48d63ff70f170a192bec3c01b04f58f45',
    reference: 'https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz',
    registry: 'bower',
  }, await createConfig());

  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'bower.json'))).name;
  expect(name).toBe('font-roboto');
});

test('TarballFetcher.fetch throws', async () => {
  const dir = await mkdir('tarball-fetcher');
  const url = 'https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz';
  const fetcher = new TarballFetcher(dir, {
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

test('TarballFetcher.fetch supports local ungzipped tarball', async () => {
  const dir = await mkdir('tarball-fetcher');
  const fetcher = new LocalTarballFetcher(dir, {
    type: 'tarball',
    hash: '76d4316a3965259f7074f167f44a7a7a393884be',
    reference: path.join(__dirname, 'fixtures', 'fetchers', 'tarball', 'ungzipped.tar'),
    registry: 'bower',
  }, await createConfig());
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'bower.json'))).name;
  expect(name).toBe('font-roboto');
});
