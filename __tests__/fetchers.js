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

test('GitFetcher.fetch fetchFromLocal not in network or cache', async () => {
  const config = await createConfig();
  const dir = await mkdir('git-fetcher');
  const fetcher = new GitFetcher(dir, {
    type: 'git',
    reference: './offline-mirror/fetch-test',
    hash: '8beb0413a8028ca2d52dbb86c75f42069535591b',
    registry: 'npm',
  }, config);
  try {
    await fetcher.fetch();
  } catch (err) {
    expect(err.message).toBe(config.reporter.lang('tarballNotInNetworkOrCache', './offline-mirror/fetch-test', path.resolve('./offline-mirror/fetch-test')));
  }
});

test('GitFetcher.fetch', async () => {
  const dir = await mkdir('git-fetcher');
  const fetcher = new GitFetcher(dir, {
    type: 'git',
    reference: 'https://github.com/sindresorhus/beeper',
    hash: '8beb0413a8028ca2d52dbb86c75f42069535591b',
    registry: 'npm',
  }, await createConfig());
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
  expect(name).toBe('beeper');
});

test('TarballFetcher.fetch', async () => {
  const dir = await mkdir('tarball-fetcher');
  const fetcher = new TarballFetcher(dir, {
    type: 'tarball',
    hash: 'a32262ca1e22a3746b970936d3944b4bfd6cb9e9',
    reference: 'https://github.com/sindresorhus/beeper/archive/master.tar.gz',
    registry: 'npm',
  }, await createConfig());

  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
  expect(name).toBe('beeper');
});

test('TarballFetcher.fetch throws on invalid hash', async () => {
  const dir = await mkdir('tarball-fetcher');
  const url = 'https://github.com/sindresorhus/beeper/archive/master.tar.gz';
  const fetcher = new TarballFetcher(dir, {
    type: 'tarball',
    hash: 'foo',
    reference: url,
    registry: 'npm',
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
    hash: '25c5098052a7bd322c7db80c26852e9209f98d4f',
    reference: path.join(__dirname, 'fixtures', 'fetchers', 'tarball', 'ungzipped.tar'),
    registry: 'npm',
  }, await createConfig());
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
  expect(name).toBe('beeper');
});

test('TarballFetcher.fetch properly stores tarball of package in offline mirror', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await createConfig();
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(dir, {
    type: 'tarball',
    hash: '6f86cbedd8be4ec987be9aaf33c9684db1b31e7e',
    reference: 'https://registry.npmjs.org/lodash.isempty/-/lodash.isempty-4.4.0.tgz',
    registry: 'npm',
  }, config);

  await fetcher.fetch();
  const exists = await fs.exists(path.join(offlineMirrorDir, 'lodash.isempty-4.4.0.tgz'));
  expect(exists).toBe(true);
});

test('TarballFetcher.fetch properly stores tarball of scoped package in offline mirror', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await createConfig();
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(dir, {
    type: 'tarball',
    hash: '6f0ab73cdd7b82d8e81e80838b49e9e4c7fbcc44',
    reference: 'https://registry.npmjs.org/@exponent/configurator/-/configurator-1.0.2.tgz',
    registry: 'npm',
  }, config);

  await fetcher.fetch();
  const exists = await fs.exists(path.join(offlineMirrorDir, '@exponent-configurator-1.0.2.tgz'));
  expect(exists).toBe(true);
});
