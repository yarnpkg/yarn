/* @flow */
/* eslint max-len: 0 */

import normalizeManifest from '../src/util/normalize-manifest/index.js';
import NoopReporter from '../src/reporters/base-reporter.js';
import Config from '../src/config.js';
import map from '../src/util/map.js';
import * as util from '../src/util/normalize-manifest/util.js';
import * as fs from '../src/util/fs.js';

const nativeFs = require('fs');
const path     = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const fixturesLoc = path.join(__dirname, 'fixtures', 'normalize-manifest');

for (const name of nativeFs.readdirSync(fixturesLoc)) {
  if (name[0] === '.') {
    continue;
  }

  const loc = path.join(fixturesLoc, name);

  test(name, async () => {
    const actualWarnings   = [];
    const expectedWarnings = await fs.readJson(path.join(loc, 'warnings.json'));

    const reporter = new NoopReporter();

    // $FlowFixMe: investigate
    reporter.warn = function(msg) {
      actualWarnings.push(msg);
    };

    const config = new Config(reporter);
    await config.init({cwd: loc});

    let actual   = await fs.readJson(path.join(loc, 'actual.json'));
    const expected = await fs.readJson(path.join(loc, 'expected.json'));

    let isRoot = actual._root;
    if (isRoot == null) {
      isRoot = true;
    } else {
      delete actual._root;
    }

    const error = expected._error;
    if (error) {
      delete expected._error;
    }

    try {
      actual = await normalizeManifest(actual, loc, config, isRoot);
    } catch (err) {
      if (error && err.message === error) {
        return;
      } else {
        throw err;
      }
    }

    if (error) {
      throw new Error(`Expected to throw error: ${error}`);
    }

    expect(map(actual)).toEqual(expand(expected));
    expect(actualWarnings).toEqual(expectedWarnings);
  });
}

test('util.stringifyPerson', () => {
  expect(util.stringifyPerson({name: 'Sebastian McKenzie'})).toEqual('Sebastian McKenzie');
  expect(util.stringifyPerson({name: 'Sebastian McKenzie', email: 'sebmck@gmail.com'})).toEqual('Sebastian McKenzie <sebmck@gmail.com>');
  expect(util.stringifyPerson({email: 'sebmck@gmail.com'})).toEqual('<sebmck@gmail.com>');
  expect(util.stringifyPerson({name: 'Sebastian McKenzie', email: 'sebmck@gmail.com', url: 'https://sebmck.com'})).toEqual('Sebastian McKenzie <sebmck@gmail.com> (https://sebmck.com)');
});

test('util.parsePerson', () => {
  expect(util.parsePerson({}), {});
  expect(util.parsePerson('Sebastian McKenzie')).toEqual({name: 'Sebastian McKenzie'});
  expect(util.parsePerson(' <sebmck@gmail.com>')).toEqual({email: 'sebmck@gmail.com'});
  expect(util.parsePerson('Sebastian McKenzie <sebmck@gmail.com>')).toEqual({name: 'Sebastian McKenzie', email: 'sebmck@gmail.com'});
  expect(util.parsePerson('Sebastian McKenzie <sebmck@gmail.com> (https://sebmck.com)')).toEqual({name: 'Sebastian McKenzie', email: 'sebmck@gmail.com', url: 'https://sebmck.com'});
});

test('util.extractDescription', () => {
  expect(util.extractDescription('# header\n\ndescription here')).toEqual('description here');
  expect(util.extractDescription('# header\ndescription here')).toEqual('description here');
  expect(util.extractDescription('# header\ndescription here\nfoobar')).toEqual('description here foobar');
  expect(util.extractDescription('# header\ndescription here\n\nfoobar')).toEqual('description here');
  expect(util.extractDescription('')).toEqual(undefined);
  expect(util.extractDescription(null)).toEqual(undefined);
  expect(util.extractDescription(undefined)).toEqual(undefined);
});

// fill out expected and normalize paths
function expand<T>(expected: T): T {
  if (expected.man && Array.isArray(expected.man)) {
    expected = {...expected, man: normalizePaths(expected.man)};
  }

  if (expected.bin && typeof expected.bin === 'object') {
    expected = {...expected, bin: normalizePathDict(expected.bin)};
  }

  return expected;
}

function normalize(input: string): string {
  return path.normalize(input);
}

function normalizePath<T>(path: T): ?string {
  if (typeof path === 'string') {
    return normalize(path);
  } else {
    return null;
  }
}

function normalizePaths(paths: mixed): ?string[] {
  if (Array.isArray(paths)) {
    return paths.map((p) => {
      if (typeof p !== 'string') {
        throw new Error(`Expected string in paths, got ${JSON.stringify(paths)}`);
      }
      return normalize(p);
    });
  } else {
    return null;
  }
}

function normalizePathDict(paths: mixed): ?{ [key: string]: mixed } {
  const out = {};

  if (!paths || typeof paths !== 'object') {
    return null;
  }

  for (const prop in paths) {
    if (typeof paths[prop] === 'string') {
      out[prop] = normalizePath(paths[prop]);
    } else {
      out[prop] = paths[prop];
    }
  }

  return out;
}
