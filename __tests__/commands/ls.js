/* @flow */

import type {Tree} from '../../src/reporters/types.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {getParent, getReqDepth, run as ls} from '../../src/cli/commands/ls.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const stream = require('stream');
const path = require('path');
const os = require('os');

function makeTree(
  name,
  {children = [], hint = null, color = null, depth = 0}: Object = {},
): Tree {
  return {
    name,
    children,
    hint,
    color,
    depth,
  };
}

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'ls');

async function runLs(
  flags: Object,
  args: Array<string>,
  name: string,
  checkLs?: ?(config: Config, reporter: BufferReporter) => ?Promise<void>,
): Promise<void> {
  const dir = path.join(fixturesLoc, name);
  const cwd = path.join(
    os.tmpdir(),
    `yarn-${path.basename(dir)}-${Math.random()}`,
  );
  await fs.unlink(cwd);
  await fs.copy(dir, cwd);

  for (const {basename, absolute} of await fs.walk(cwd)) {
    if (basename.toLowerCase() === '.ds_store') {
      await fs.unlink(absolute);
    }
  }

  let out = '';
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  const reporter = new reporters.BufferReporter({stdout: null, stdin: null});

  // create directories
  await fs.mkdirp(path.join(cwd, '.yarn'));
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    const config = new Config(reporter);
    await config.init({
      cwd,
      globalFolder: path.join(cwd, '.yarn/.global'),
      cacheFolder: path.join(cwd, '.yarn'),
      linkFolder: path.join(cwd, '.yarn/.link'),
    });

    await ls(config, reporter, flags, args);

    if (checkLs) {
      await checkLs(config, reporter);
    }

  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}

test.concurrent('throws if lockfile out of date', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve) => {
    try {
      await runLs({}, [], 'lockfile-outdated');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('lockfileOutdated'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('lists everything with no args', (): Promise<void> => {
  return runLs({}, [], 'no-args', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({});
    const tree = reporter.getBuffer().slice(-1);
    const children = [{name: 'is-plain-obj@^1.0.0', color: 'dim', shadow: true}];
    const trees = [
      makeTree('left-pad@1.1.3', {color: 'bold'}),
      makeTree('sort-keys@1.1.2', {children, color: 'bold'}),
      makeTree('is-plain-obj@1.1.0'),
    ];

    rprtr.tree('ls', trees);

    expect(tree).toEqual(rprtr.getBuffer());
  });
});

test.concurrent('respects depth flag', (): Promise<void> => {
  return runLs({depth: 1}, [], 'depth-flag', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({});
    const tree = reporter.getBuffer().slice(-1);
    const trees = [
      makeTree('sort-keys@1.1.2', {color: 'bold'}),
      makeTree('is-plain-obj@1.1.0'),
    ];

    rprtr.tree('ls', trees);

    expect(tree).toEqual(rprtr.getBuffer());
  });
});

test.concurrent('accepts an argument', (): Promise<void> => {
  return runLs({}, ['is-plain-obj'], 'one-arg', (config, reporter): ?Promise<void> => {
    const rprtr = new reporters.BufferReporter({});
    const tree = reporter.getBuffer().slice(-1);
    const trees = [
      makeTree('is-plain-obj@1.1.0'),
    ];

    rprtr.tree('ls', trees);

    expect(tree).toEqual(rprtr.getBuffer());
  });
});

test('getParent should extract a parent object from a hash, if the parent key exists', () => {
  const mockTreesByKey = {};

  mockTreesByKey['parentPkg'] = {
    name: 'parent@1.1.1',
    children: [],
  };
  const res = getParent('parentPkg#childPkg', mockTreesByKey);

  expect(res instanceof Object).toBe(true);
  expect(res.name).toBe('parent@1.1.1');
  expect(res.children.length).toBe(0);
});

test('getParent should return undefined if the key does not exist in hash', () => {
  const mockTreesByKey = {};
  mockTreesByKey['parentPkg'] = { };

  const res = getParent('parentPkg#childPkg', mockTreesByKey);
  expect(res.name).not.toBeDefined();
  expect(res.children).not.toBeDefined();
});

test('getReqDepth should return a number if valid', () => {
  expect(getReqDepth('1')).toEqual(1);
  expect(getReqDepth('01')).toEqual(1);
});

test('getReqDepth should return -1 if invalid', () => {
  expect(getReqDepth('foo')).toEqual(-1);
  expect(getReqDepth('bar')).toEqual(-1);
  expect(getReqDepth('')).toEqual(-1);
});
