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

import normaliseManifest from '../src/util/normalise-manifest/index.js';
import map from '../src/util/map.js';
import * as util from '../src/util/normalise-manifest/util.js';
import * as fs from '../src/util/fs.js';

let nativeFs = require('fs');
let path     = require('path');

let fixturesLoc = path.join(__dirname, 'fixtures', 'normalise-manifest');

for (let name of nativeFs.readdirSync(fixturesLoc)) {
  if (name[0] === '.') {
    continue;
  }

  let loc = path.join(fixturesLoc, name);

  test(name, async () => {
    let actualWarnings   = [];
    let expectedWarnings = await fs.readJson(path.join(loc, 'warnings.json'));

    function warn(msg) {
      actualWarnings.push(msg);
    }

    let actual   = await fs.readJson(path.join(loc, 'actual.json'));
    let expected = await fs.readJson(path.join(loc, 'expected.json'));

    let error = expected._error;
    if (error) {
      delete expected._error;
    }

    try {
      actual = await normaliseManifest(actual, loc, warn);
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

    expect(map(actual)).toEqual(map(expected));
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

fit('util.extractDescription', () => {
  expect(util.extractDescription(map('# header\n\ndescription here'))).toEqual(map('description here'));
  expect(util.extractDescription(map('# header\ndescription here'))).toEqual(map('description here'));
  expect(util.extractDescription(map('# header\ndescription here\nfoobar'))).toEqual(map('description here foobar'));
  expect(util.extractDescription(map('# header\ndescription here\n\nfoobar'))).toEqual(map('description here'));
  expect(util.extractDescription(map(''))).toEqual(map(undefined));
  expect(util.extractDescription(map(null))).toEqual(map(undefined));
  expect(util.extractDescription(map(undefined))).toEqual(map(undefined));
});
