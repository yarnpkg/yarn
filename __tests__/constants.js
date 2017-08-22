/* @flow */

import {getPathKey, isProduction} from '../src/constants.js';

test('getPathKey', () => {
  expect(getPathKey('win32', {PATH: 'foobar'})).toBe('PATH');
  expect(getPathKey('win32', {Path: 'foobar'})).toBe('Path');
  expect(getPathKey('win32', {PaTh: 'foobar'})).toBe('PaTh');
  expect(getPathKey('win32', {})).toBe('Path');
  expect(getPathKey('linux', {})).toBe('PATH');
  expect(getPathKey('darwin', {})).toBe('PATH');
});

describe('isProduction', () => {
  const env = {
    NODE_ENV: '',
  };
  test('passing "development" should return false', () => {
    env.NODE_ENV = 'development';
    expect(isProduction(env)).toBe(false);
  });

  test('passing "production" should return true', () => {
    env.NODE_ENV = 'production';
    expect(isProduction(env)).toBe(true);
  });
});
