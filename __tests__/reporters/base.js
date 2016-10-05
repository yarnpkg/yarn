/* @flow */
/* eslint yarn-internal/warn-language: 0 */

import BaseReporter from '../../src/reporters/base-reporter.js';

test('BaseReporter.getTotalTime', () => {
  const reporter = new BaseReporter();
  expect(reporter.getTotalTime() <= 1).toBeTruthy();
  reporter.close();
});

test('BaseReporter.step', () => {
  const reporter = new BaseReporter();
  reporter.step(1, 5, 'foo');
  reporter.close();
});

test('BaseReporter.error', () => {
  const reporter = new BaseReporter();
  reporter.error('');
  reporter.close();
});

test('BaseReporter.warn', () => {
  const reporter = new BaseReporter();
  reporter.warn('');
  reporter.close();
});

test('BaseReporter.info', () => {
  const reporter = new BaseReporter();
  reporter.info('');
  reporter.close();
});

test('BaseReporter.success', () => {
  const reporter = new BaseReporter();
  reporter.success('');
  reporter.close();
});

test('BaseReporter.log', () => {
  const reporter = new BaseReporter();
  reporter.log('');
  reporter.close();
});

test('BaseReporter.info', () => {
  const reporter = new BaseReporter();
  reporter.log('');
  reporter.close();
});

test('BaseReporter.command', () => {
  const reporter = new BaseReporter();
  reporter.command('');
  reporter.close();
});

test('BaseReporter.header', () => {
  const reporter = new BaseReporter();
  reporter.header('', {name: '', version: ''});
  reporter.close();
});

test('BaseReporter.footer', () => {
  const reporter = new BaseReporter();
  reporter.footer(false);
  reporter.close();
});

test('BaseReporter.activity', () => {
  const reporter = new BaseReporter();
  const activity = reporter.activity();
  activity.tick('');
  activity.end();
  reporter.close();
});

test('BaseReporter.question', async () => {
  const reporter = new BaseReporter();
  let error;
  try {
    await reporter.question('');
  } catch (e) {
    error = e;
  }
  expect(error).not.toBeUndefined();
  reporter.close();
});

test('BaseReporter.select', async () => {
  const reporter = new BaseReporter();
  let error;
  try {
    await reporter.select('?', '', []);
  } catch (e) {
    error = e;
  }
  expect(error).not.toBeUndefined();
  reporter.close();
});

test('BaseReporter.progress', () => {
  const reporter = new BaseReporter();
  const tick = reporter.progress(1);
  tick();
  reporter.close();
});
