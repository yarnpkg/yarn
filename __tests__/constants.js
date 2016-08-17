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

import {getPathKey} from '../src/constants.js';

test('getPathKey', () => {
  expect(getPathKey('win32', {PATH: 'foobar'})).toBe('PATH');
  expect(getPathKey('win32', {Path: 'foobar'})).toBe('Path');
  expect(getPathKey('win32', {PaTh: 'foobar'})).toBe('PaTh');
  expect(getPathKey('win32', {})).toBe('Path');
  expect(getPathKey('linux', {})).toBe('PATH');
  expect(getPathKey('darwin', {})).toBe('PATH');
});
