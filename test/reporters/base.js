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

import BaseReporter from '../../src/reporters/base-reporter.js';

let test = require('ava');

test('BaseReporter.getTotalTime', (t) => {
  let reporter = new BaseReporter();
  t.true(reporter.getTotalTime() <= 1);
  reporter.close();
});

test('BaseReporter.step', () => {
  let reporter = new BaseReporter();
  reporter.step(1, 5, 'foo');
  reporter.close();
});

test('BaseReporter.error', () => {
  let reporter = new BaseReporter();
  reporter.error('');
  reporter.close();
});

test('BaseReporter.warn', () => {
  let reporter = new BaseReporter();
  reporter.warn('');
  reporter.close();
});

test('BaseReporter.info', () => {
  let reporter = new BaseReporter();
  reporter.info('');
  reporter.close();
});

test('BaseReporter.success', () => {
  let reporter = new BaseReporter();
  reporter.success('');
  reporter.close();
});

test('BaseReporter.log', () => {
  let reporter = new BaseReporter();
  reporter.log('');
  reporter.close();
});

test('BaseReporter.info', () => {
  let reporter = new BaseReporter();
  reporter.log('');
  reporter.close();
});

test('BaseReporter.command', () => {
  let reporter = new BaseReporter();
  reporter.command('');
  reporter.close();
});

test('BaseReporter.header', () => {
  let reporter = new BaseReporter();
  reporter.header('', {name: '', version: ''});
  reporter.close();
});

test('BaseReporter.footer', () => {
  let reporter = new BaseReporter();
  reporter.footer(false);
  reporter.close();
});

test('BaseReporter.activity', () => {
  let reporter = new BaseReporter();
  let activity = reporter.activity();
  activity.tick('');
  activity.end();
  reporter.close();
});

test('BaseReporter.question', async (t) => {
  let reporter = new BaseReporter();
  let error;
  try {
    await reporter.question('');
  } catch (e) {
    error = e;
  }
  t.truthy(error);
  reporter.close();
});

test('BaseReporter.select', async (t) => {
  let reporter = new BaseReporter();
  let error;
  try {
    await reporter.select('', '', []);
  } catch (e) {
    error = e;
  }
  t.truthy(error);
  reporter.close();
});

test('BaseReporter.progress', () => {
  let reporter = new BaseReporter();
  let tick = reporter.progress(1);
  tick();
  reporter.close();
});
