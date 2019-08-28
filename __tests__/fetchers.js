/* @flow */
/* eslint max-len: 0 */

import {Reporter} from '../src/reporters/index.js';
import TarballFetcher, {LocalTarballFetcher} from '../src/fetchers/tarball-fetcher.js';
import BaseFetcher from '../src/fetchers/base-fetcher.js';
import CopyFetcher from '../src/fetchers/copy-fetcher.js';
import GitFetcher from '../src/fetchers/git-fetcher.js';
import Config from '../src/config.js';
import mkdir from './_temp.js';
import * as fs from '../src/util/fs.js';
import {readdirSync} from 'fs';

const path = require('path');
const ssri = require('ssri');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

test('BaseFetcher.fetch', async () => {
  const dir = await mkdir('base-fetcher');
  const fetcher = new BaseFetcher(
    dir,
    {
      type: 'base',
      registry: 'npm',
      reference: '',
      hash: null,
    },
    await Config.create(),
  );
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
  const fetcher = new CopyFetcher(
    b,
    {
      type: 'copy',
      reference: a,
      registry: 'npm',
      hash: null,
    },
    await Config.create(),
  );
  await fetcher.fetch();
  const content = await fs.readFile(path.join(b, 'package.json'));
  expect(content).toBe('{}');
  const contentFoo = await fs.readFile(path.join(b, 'foo'));
  expect(contentFoo).toBe('bar');
});

test('GitFetcher.fetch', async () => {
  const dir = await mkdir('git-fetcher');
  const fetcher = new GitFetcher(
    dir,
    {
      type: 'git',
      reference: 'https://github.com/sindresorhus/beeper',
      hash: '8beb0413a8028ca2d52dbb86c75f42069535591b',
      registry: 'npm',
    },
    await Config.create(),
  );
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
  expect(name).toBe('beeper');
});

test('GitFetcher.getTarballMirrorPath without slashes in the repo path', async () => {
  const dir = await mkdir('git-fetcher');
  const config = await Config.create();
  config.registries.yarn.config['yarn-offline-mirror'] = 'test';

  const fetcher = new GitFetcher(
    dir,
    {
      type: 'git',
      reference: 'ssh://git@github.com:example-without-slash-repo.git',
      hash: '8beb0413a8028ca2d52dbb86c75f42069535591b',
      registry: 'npm',
    },
    config,
  );
  const cachePath = fetcher.getTarballMirrorPath();
  expect(cachePath).toBe(path.join('test', 'example-without-slash-repo.git-8beb0413a8028ca2d52dbb86c75f42069535591b'));
});

test('GitFetcher.fetch with prepare script', async () => {
  const dir = await mkdir('git-fetcher-with-prepare');
  const fetcher = new GitFetcher(
    dir,
    {
      type: 'git',
      reference: 'https://github.com/Volune/test-js-git-repo',
      hash: '0e56593e326069ed4bcec8126bb48a1891215c57',
      registry: 'npm',
    },
    await Config.create(),
  );
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
  expect(name).toBe('test-js-git-repo');
  const dependencyName = (await fs.readJson(path.join(dir, 'dependency-package.json'))).name;
  expect(dependencyName).toBe('beeper');
  // The file "prepare.js" is not in "files" list
  expect(await fs.exists(path.join(dir, 'prepare.js'))).toBe(false);
  // Check the dependency with a bin script was correctly executed
  expect(await fs.exists(path.join(dir, 'testscript.output.txt'))).toBe(true);
  // Check executed lifecycle scripts
  expect(await fs.exists(path.join(dir, 'generated', 'preinstall'))).toBe(true);
  expect(await fs.exists(path.join(dir, 'generated', 'install'))).toBe(true);
  expect(await fs.exists(path.join(dir, 'generated', 'postinstall'))).toBe(true);
  expect(await fs.exists(path.join(dir, 'generated', 'prepublish'))).toBe(false);
});

test('GitFetcher.fetch with prepare script, NODE_ENV=production', async () => {
  const NODE_ENV = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const dir = await mkdir('git-fetcher-with-prepare');
    const fetcher = new GitFetcher(
      dir,
      {
        type: 'git',
        reference: 'https://github.com/Volune/test-js-git-repo',
        hash: '0e56593e326069ed4bcec8126bb48a1891215c57',
        registry: 'npm',
      },
      await Config.create(),
    );
    await fetcher.fetch();
    const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
    expect(name).toBe('test-js-git-repo');
    const dependencyName = (await fs.readJson(path.join(dir, 'dependency-package.json'))).name;
    expect(dependencyName).toBe('beeper');
    // The file "prepare.js" is not in "files" list
    expect(await fs.exists(path.join(dir, 'prepare.js'))).toBe(false);
    // Check the dependency with a bin script was correctly executed
    expect(await fs.exists(path.join(dir, 'testscript.output.txt'))).toBe(true);
    // Check executed lifecycle scripts
    expect(await fs.exists(path.join(dir, 'generated', 'preinstall'))).toBe(true);
    expect(await fs.exists(path.join(dir, 'generated', 'install'))).toBe(true);
    expect(await fs.exists(path.join(dir, 'generated', 'postinstall'))).toBe(true);
    expect(await fs.exists(path.join(dir, 'generated', 'prepublish'))).toBe(false);
  } finally {
    process.env.NODE_ENV = NODE_ENV;
  }
});

test('TarballFetcher.fetch', async () => {
  const dir = await mkdir('tarball-fetcher');
  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '51f12d36860fc3d2ab747377991746e8ea3faabb',
      reference: 'https://github.com/sindresorhus/beeper/archive/master.tar.gz',
      registry: 'npm',
    },
    await Config.create(),
  );

  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
  expect(name).toBe('beeper');
});

test('TarballFetcher.fetch throws on invalid hash', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await Config.create({}, new Reporter());
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const url = 'https://github.com/sindresorhus/beeper/archive/master.tar.gz';
  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: 'abcd',
      reference: url,
      registry: 'npm',
    },
    config,
  );

  expect(fetcher.fetch()).rejects.toMatchObject({
    message: expect.stringContaining("computed integrity doesn't match our records"),
  });
  expect(readdirSync(path.join(offlineMirrorDir))).toEqual([]);
});

test('TarballFetcher.fetch fixes hash if updateChecksums flag is true', async () => {
  const wrongHash = 'abcd';
  const dir = await mkdir(`tarball-fetcher-${wrongHash}`);
  const config = await Config.create({}, new Reporter());
  config.updateChecksums = true;
  const url = 'https://github.com/sindresorhus/beeper/archive/master.tar.gz';
  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: wrongHash,
      reference: url,
      registry: 'npm',
    },
    config,
  );
  await fetcher.fetch();
  const dirWithProperHash = dir.replace(wrongHash, fetcher.hash);
  const name = (await fs.readJson(path.join(dirWithProperHash, 'package.json'))).name;
  expect(name).toBe('beeper');
});

test('TarballFetcher.fetch throws on invalid integrity', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await Config.create({}, new Reporter());
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '6f86cbedd8be4ec987be9aaf33c9684db1b31e7e',
      reference: 'https://registry.npmjs.org/lodash.isempty/-/lodash.isempty-4.4.0.tgz',
      registry: 'npm',
      integrity: ssri.parse('sha512-foo'),
    },
    config,
  );

  expect(fetcher.fetch()).rejects.toMatchObject({
    message: expect.stringContaining("computed integrity doesn't match our records"),
  });
  expect(readdirSync(path.join(offlineMirrorDir))).toEqual([]);
});

test('TarballFetcher.fetch supports local ungzipped tarball', async () => {
  const dir = await mkdir('tarball-fetcher');
  const fetcher = new LocalTarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '25c5098052a7bd322c7db80c26852e9209f98d4f',
      reference: path.join(__dirname, 'fixtures', 'fetchers', 'tarball', 'ungzipped.tar'),
      registry: 'npm',
    },
    await Config.create(),
  );
  await fetcher.fetch();
  const name = (await fs.readJson(path.join(dir, 'package.json'))).name;
  expect(name).toBe('beeper');
});

test('TarballFetcher.fetch properly stores tarball of package in offline mirror', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await Config.create();
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '6f86cbedd8be4ec987be9aaf33c9684db1b31e7e',
      reference: 'https://registry.npmjs.org/lodash.isempty/-/lodash.isempty-4.4.0.tgz',
      registry: 'npm',
    },
    config,
  );

  await fetcher.fetch();
  const exists = await fs.exists(path.join(offlineMirrorDir, 'lodash.isempty-4.4.0.tgz'));
  expect(exists).toBe(true);
});

test('TarballFetcher.fetch properly stores tarball of scoped package in offline mirror', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await Config.create();
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '6f0ab73cdd7b82d8e81e80838b49e9e4c7fbcc44',
      reference: 'https://registry.npmjs.org/@exponent/configurator/-/configurator-1.0.2.tgz',
      registry: 'npm',
    },
    config,
  );

  await fetcher.fetch();
  const exists = await fs.exists(path.join(offlineMirrorDir, '@exponent-configurator-1.0.2.tgz'));
  expect(exists).toBe(true);
});

test('TarballFetcher.fetch properly stores tarball of scoped package in offline mirror for Verdaccio', async () => {
  const dir = await mkdir('git-fetcher');
  const config = await Config.create();
  config.registries.yarn.config['yarn-offline-mirror'] = 'test';

  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '6f0ab73cdd7b82d8e81e80838b49e9e4c7fbcc44',
      reference: 'http://npm.xxxyyyzzz.ru/@types%2fevents/-/events-3.0.0.tgz',
      registry: 'npm',
    },
    config,
  );
  const cachePath = fetcher.getTarballMirrorPath();
  expect(cachePath).toBe(path.join('test', '@types-events-3.0.0.tgz'));
});

test('TarballFetcher.fetch properly stores tarball for scoped package resolved from artifactory registry', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await Config.create();
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '6f0ab73cdd7b82d8e81e80838b49e9e4c7fbcc44',
      reference:
        'https://artifactory.internal.site:443/artifactory/api/npm/external-mirror/@exponent/configurator/-/configurator-1.0.2.tgz',
      registry: 'npm',
    },
    config,
  );

  expect(fetcher.getTarballMirrorPath()).toBe(path.join(offlineMirrorDir, '@exponent-configurator-1.0.2.tgz'));
});

test('TarballFetcher.fetch properly stores tarball for scoped package resolved from new  style URLs', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await Config.create();
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '6f0ab73cdd7b82d8e81e80838b49e9e4c7fbcc44',
      reference:
        'https://artifactory.internal.site:443/artifactory/api/npm/external-mirror/@exponent/configurator/-/@exponent/configurator-1.0.2.tgz',
      registry: 'npm',
    },
    config,
  );

  expect(fetcher.getTarballMirrorPath()).toBe(path.join(offlineMirrorDir, '@exponent-configurator-1.0.2.tgz'));
});

test('TarballFetcher.fetch properly stores tarball for scoped package resolved from npm enterprise registry', async () => {
  const dir = await mkdir('tarball-fetcher');
  const offlineMirrorDir = await mkdir('offline-mirror');

  const config = await Config.create();
  config.registries.npm.config['yarn-offline-mirror'] = offlineMirrorDir;

  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '6f0ab73cdd7b82d8e81e80838b49e9e4c7fbcc44',
      reference: 'https://npm.internal.site:443/@/@exponent/configurator/_attachments/configurator-1.0.2.tgz',
      registry: 'npm',
    },
    config,
  );

  expect(fetcher.getTarballMirrorPath()).toBe(path.join(offlineMirrorDir, '@exponent-configurator-1.0.2.tgz'));
});

test('TarballFetcher.fetch throws on truncated tar data', async () => {
  const dir = await mkdir('tarball-fetcher');
  const reporter = new Reporter();
  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '5b0482e1cc75d37dfc7f6e6d663d08c96442dcd5',
      reference: 'file:' + path.join(__dirname, 'fixtures', 'fetchers', 'tarball', 'broken-tar-data.tgz'),
      registry: 'npm',
    },
    await Config.create({}, reporter),
  );
  await expect(fetcher.fetch()).rejects.toThrow(
    // The "." in ".tgz" should be escaped, but that doesn't work with reporter.lang
    new RegExp(reporter.lang('errorExtractingTarball', '.*', '.*broken-tar-data.tgz')),
  );
});

test('TarballFetcher.fetch throws on truncated tar header', async () => {
  const dir = await mkdir('tarball-fetcher');
  const reporter = new Reporter();
  const fetcher = new TarballFetcher(
    dir,
    {
      type: 'tarball',
      hash: '1d403a8c7ef4ce25b1e7b188ede272a42ce49a52',
      reference: 'file:' + path.join(__dirname, 'fixtures', 'fetchers', 'tarball', 'broken-tar-header.tgz'),
      registry: 'npm',
    },
    await Config.create({}, reporter),
  );
  await expect(fetcher.fetch()).rejects.toThrow(
    // The "." in ".tgz" should be escaped, but that doesn't work with reporter.lang
    new RegExp(reporter.lang('errorExtractingTarball', '.*', '.*broken-tar-header.tgz')),
  );
});
