/* @flow */

import {getPathKey, isRootUser} from '../src/constants.js';

test('getPathKey', () => {
  expect(getPathKey('win32', {PATH: 'foobar'})).toBe('PATH');
  expect(getPathKey('win32', {Path: 'foobar'})).toBe('Path');
  expect(getPathKey('win32', {PaTh: 'foobar'})).toBe('PaTh');
  expect(getPathKey('win32', {})).toBe('Path');
  expect(getPathKey('linux', {})).toBe('PATH');
  expect(getPathKey('darwin', {})).toBe('PATH');
});

test('isRootUser', () => {
  expect(isRootUser('win32', null)).toBe(false);
  expect(isRootUser('linux', 1001)).toBe(false);
  expect(isRootUser('linux', 0)).toBe(true);
  expect(isRootUser('darwin', 1)).toBe(false);
  expect(isRootUser('darwin', 0)).toBe(true);
});
