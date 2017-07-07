/* @flow */

import {testEngine} from '../src/package-compatibility.js';

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
});
