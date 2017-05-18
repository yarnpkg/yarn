/* @flow */

import type {Tree} from '../../src/reporters/types.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {getParent, getReqDepth, run as list} from '../../src/cli/commands/list.js';
import * as reporters from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

function makeTree(name, {children = [], hint = null, color = null, depth = 0}: Object = {}): Tree {
  return {
    name,
    children,
    hint,
    color,
    depth,
  };
}

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'list');
const runList = buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter): Promise<void> => {
  return list(config, reporter, flags, args);
});

test.concurrent('throws if lockfile out of date', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async resolve => {
    try {
      await runList([], {}, 'lockfile-outdated');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('lockfileOutdated'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('lists everything with no args', (): Promise<void> => {
  return runList([], {}, 'no-args', (config, reporter): ?Promise<void> => {
    const rprtr = new BufferReporter({});
    const tree = reporter.getBuffer().slice(-1);
    const children = [{name: 'is-plain-obj@^1.0.0', color: 'dim', shadow: true}];
    const trees = [
      makeTree('left-pad@1.1.3', {color: 'bold'}),
      makeTree('sort-keys@1.1.2', {children, color: 'bold'}),
      makeTree('is-plain-obj@1.1.0'),
    ];

    rprtr.tree('list', trees);

    expect(tree).toEqual(rprtr.getBuffer());
  });
});

test.concurrent('respects depth flag', (): Promise<void> => {
  return runList([], {depth: 1}, 'depth-flag', (config, reporter): ?Promise<void> => {
    const rprtr = new BufferReporter({});
    const tree = reporter.getBuffer().slice(-1);
    const trees = [makeTree('sort-keys@1.1.2', {color: 'bold'}), makeTree('is-plain-obj@1.1.0')];

    rprtr.tree('list', trees);

    expect(tree).toEqual(rprtr.getBuffer());
  });
});

test.concurrent('accepts an argument', (): Promise<void> => {
  return runList(['is-plain-obj'], {}, 'one-arg', (config, reporter): ?Promise<void> => {
    const rprtr = new BufferReporter({});
    const tree = reporter.getBuffer().slice(-1);
    const trees = [makeTree('is-plain-obj@1.1.0')];

    rprtr.tree('list', trees);

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
  mockTreesByKey['parentPkg'] = {};

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
