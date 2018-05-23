/* @flow */
/* eslint yarn-internal/warn-language: 0 */

import BaseReporter, {stringifyLangArgs} from '../../src/reporters/base-reporter.js';
import {EOL} from 'os';

test('BaseReporter.getTotalTime', () => {
  const reporter = new BaseReporter();
  expect(typeof reporter.getTotalTime() === 'number').toBeTruthy();
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

test('BaseReporter.disableProgress', () => {
  const reporter = new BaseReporter();
  reporter.disableProgress();
  expect(reporter.noProgress).toBeTruthy();
});

test('BaseReporter.termstrings', () => {
  const reporter = new BaseReporter();
  const expected = '"\u001b[2mjsprim#\u001b[22mjson-schema" not installed';
  expect(reporter.lang('packageNotInstalled', '\u001b[2mjsprim#\u001b[22mjson-schema')).toEqual(expected);
});

test('BaseReporter.prompt', async () => {
  const reporter = new BaseReporter();
  let error;
  try {
    await reporter.prompt('', []);
  } catch (e) {
    error = e;
  }
  expect(error).not.toBeUndefined();
  reporter.close();
});

test('stringifyLangArgs should replace \\n and \\r\\n with new line', () => {
  const input = '\r\nUnexpected token 123\r\nat position\n.Try again';
  const expected = `"${EOL}Unexpected token 123${EOL}at position${EOL}.Try again"`;
  expect(stringifyLangArgs([input])).toEqual([expected]);
});

test('stringifyLangArgs should not replace \\\\n with new line', () => {
  const input = 'Directory not found: C:\\Users\\An\\Documents\\Projects\\newProject';
  const expected = '"Directory not found: C:\\\\Users\\\\An\\\\Documents\\\\Projects\\\\newProject"';

  expect(stringifyLangArgs([input])).toEqual([expected]);
});
