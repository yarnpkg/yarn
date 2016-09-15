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

 import {testEngine} from '../src/package-compatibility.js';

 test('node semver semantics', () => {
   expect(testEngine('node', '^5.0.0', {node: '5.1.0'})).toEqual(true);
   expect(testEngine('node', '^0.13.0', {node: '5.0.0'})).toEqual(true);
   expect(testEngine('node', '^0.12.0', {node: '5.0.0'})).toEqual(true);
   expect(testEngine('node', '^0.11.0', {node: '5.0.0'})).toEqual(true);
   expect(testEngine('node', '^0.10.0', {node: '5.0.0'})).toEqual(true);
   expect(testEngine('node', '^0.9.0', {node: '5.0.0'})).toEqual(false);
   expect(testEngine('node', '^0.12.0', {node: '0.12.0'})).toEqual(true);
   expect(testEngine('node', '^0.12.0', {node: '0.11.0'})).toEqual(false);
 });
