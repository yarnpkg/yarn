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
