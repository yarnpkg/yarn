/* @flow */
/* eslint quotes: 0 */

import type {MockData} from './_mock.js';
import JSONReporter from '../../src/reporters/json-reporter.js';
import build from './_mock.js';

const getJSONBuff = build(JSONReporter, (data): MockData => data);

test('JSONReporter.step', async () => {
  expect(
    await getJSONBuff(r => {
      r.step(1, 5, 'foobar');
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.footer', async () => {
  expect(
    await getJSONBuff(r => {
      r.footer(false);
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.log', async () => {
  expect(
    await getJSONBuff(r => {
      r.log('foobar');
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.command', async () => {
  expect(
    await getJSONBuff(r => {
      r.command('foobar');
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.success', async () => {
  expect(
    await getJSONBuff(r => {
      r.success('foobar');
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.error', async () => {
  expect(
    await getJSONBuff(r => {
      r.error('foobar');
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.warn', async () => {
  expect(
    await getJSONBuff(r => {
      r.warn('foobar');
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.info', async () => {
  expect(
    await getJSONBuff(r => {
      r.info('foobar');
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.activity', async () => {
  expect(
    await getJSONBuff(async function(r): Promise<void> {
      r.noProgress = false;
      const activity = await r.activity();
      activity.tick('foo');
      activity.tick('bar');
      activity.end();
    }),
  ).toMatchSnapshot();

  expect(
    await getJSONBuff(async function(r): Promise<void> {
      r.noProgress = true;
      const activity = await r.activity();
      activity.tick('foo');
      activity.tick('bar');
      activity.end();
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.progress', async () => {
  expect(
    await getJSONBuff(async function(r): Promise<void> {
      r.noProgress = false;
      const tick = await r.progress(2);
      tick();
      tick();
    }),
  ).toMatchSnapshot();

  expect(
    await getJSONBuff(async function(r): Promise<void> {
      r.noProgress = true;
      const tick = await r.progress(2);
      tick();
    }),
  ).toMatchSnapshot();
});
