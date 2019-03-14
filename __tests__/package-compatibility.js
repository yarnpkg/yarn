/* @flow */

import {testEngine, shouldCheck} from '../src/package-compatibility.js';

test('node semver semantics', () => {
  expect(testEngine('node', '^5.0.0', {node: '5.1.0'}, true)).toEqual(true);
  expect(testEngine('node', '^5.0.0', {node: '5.01.0'}, true)).toEqual(true);
  expect(testEngine('node', '^5.0.0', {node: '5.01.0'}, false)).toEqual(false);
  expect(testEngine('node', '^0.13.0', {node: '5.0.0'}, true)).toEqual(true);
  expect(testEngine('node', '^0.12.0', {node: '5.0.0'}, true)).toEqual(true);
  expect(testEngine('node', '^0.11.0', {node: '5.0.0'}, true)).toEqual(true);
  expect(testEngine('node', '^0.10.0', {node: '5.0.0'}, true)).toEqual(true);
  expect(testEngine('node', '^0.9.0', {node: '5.0.0'}, true)).toEqual(false);
  expect(testEngine('node', '^0.12.0', {node: '0.12.0'}, true)).toEqual(true);
  expect(testEngine('node', '^0.12.0', {node: '0.11.0'}, true)).toEqual(false);
  expect(testEngine('node', '^1.3.0', {node: '1.4.1-20180208.2355'}, true)).toEqual(false);
});

test('ignore semver prerelease semantics for yarn', () => {
  expect(testEngine('yarn', '^1.3.0', {yarn: '1.4.1-20180208.2355'}, true)).toEqual(true);
});

test('shouldCheck returns true if ignorePlatform is false and the manifest specifies an os or cpu requirement', () => {
  expect(
    shouldCheck(
      {
        os: ['darwin'],
      },
      {ignorePlatform: false, ignoreEngines: false},
    ),
  ).toBe(true);

  expect(
    shouldCheck(
      {
        cpu: ['i32'],
      },
      {ignorePlatform: false, ignoreEngines: false},
    ),
  ).toBe(true);

  expect(shouldCheck({}, {ignorePlatform: false, ignoreEngines: false})).toBe(false);

  expect(
    shouldCheck(
      {
        os: [],
        cpu: [],
      },
      {ignorePlatform: false, ignoreEngines: false},
    ),
  ).toBe(false);

  expect(
    shouldCheck(
      {
        cpu: ['i32'],
        os: ['darwin'],
      },
      {ignorePlatform: true, ignoreEngines: false},
    ),
  ).toBe(false);
});

test('shouldCheck returns true if ignoreEngines is false and the manifest specifies engines', () => {
  expect(
    shouldCheck(
      {
        engines: {node: '>= 10'},
      },
      {ignorePlatform: false, ignoreEngines: false},
    ),
  ).toBe(true);

  expect(shouldCheck({}, {ignorePlatform: false, ignoreEngines: false})).toBe(false);

  expect(
    shouldCheck(
      {
        engines: {node: '>= 10'},
      },
      {ignorePlatform: false, ignoreEngines: true},
    ),
  ).toBe(false);
});
