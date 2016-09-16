/* @flow */

import {getPathKey} from '../src/constants.js';

test('getPathKey', () => {
  expect(getPathKey('win32', {PATH: 'foobar'})).toBe('PATH');
  expect(getPathKey('win32', {Path: 'foobar'})).toBe('Path');
  expect(getPathKey('win32', {PaTh: 'foobar'})).toBe('PaTh');
  expect(getPathKey('win32', {})).toBe('Path');
  expect(getPathKey('linux', {})).toBe('PATH');
  expect(getPathKey('darwin', {})).toBe('PATH');
});
