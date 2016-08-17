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

import BufferReporter from '../../src/reporters/BufferReporter.js';
import build from './_mock.js';

let getBuff = build(BufferReporter, (data, reporter: any): Array<Object> => reporter.getBuffer());

test('BufferReporter.finished', async () => {
  expect(await getBuff((r) => {
    r.footer(false);
  })).toEqual([{
    type: 'finished',
    data: 0,
  }]);
});

test('BufferReporter.step', async () => {
  expect(await getBuff((r) => {
    r.step(1, 5, 'foobar');
  })).toEqual([{
    type: 'step',
    data: {
      current: 1,
      total: 5,
      message: 'foobar',
    },
  }]);
});

test('BufferReporter.log', async () => {
  expect(await getBuff((r) => {
    r.log('foobar');
  })).toEqual([{
    type: 'log',
    data: 'foobar',
  }]);
});

test('BufferReporter.success', async () => {
  expect(await getBuff((r) => {
    r.success('foobar');
  })).toEqual([{
    type: 'success',
    data: 'foobar',
  }]);
});

test('BufferReporter.error', async () => {
  expect(await getBuff((r) => {
    r.error('foobar');
  })).toEqual([{
    type: 'error',
    data: 'foobar',
  }]);
});

test('BufferReporter.info', async () => {
  expect(await getBuff((r) => {
    r.info('foobar');
  })).toEqual([{
    type: 'info',
    data: 'foobar',
  }]);
});

test('BufferReporter.command', async () => {
  expect(await getBuff((r) => {
    r.command('foobar');
  })).toEqual([{
    type: 'command',
    data: 'foobar',
  }]);
});

test('BufferReporter.warn', async () => {
  expect(await getBuff((r) => {
    r.warn('foobar');
  })).toEqual([{
    type: 'warning',
    data: 'foobar',
  }]);
});
