/* @flow */

import BufferReporter from '../../src/reporters/buffer-reporter.js';
import build from './_mock.js';

const getBuff = build(BufferReporter, (data, reporter: any): Array<Object> => reporter.getBuffer());

test('BufferReporter.finished', async () => {
  expect(
    await getBuff(r => {
      r.footer(false);
    }),
  ).toMatchSnapshot();
});

test('BufferReporter.step', async () => {
  expect(
    await getBuff(r => {
      r.step(1, 5, 'foobar');
    }),
  ).toMatchSnapshot();
});

test('BufferReporter.log', async () => {
  expect(
    await getBuff(r => {
      r.log('foobar');
    }),
  ).toMatchSnapshot();
});

test('BufferReporter.success', async () => {
  expect(
    await getBuff(r => {
      r.success('foobar');
    }),
  ).toMatchSnapshot();
});

test('BufferReporter.error', async () => {
  expect(
    await getBuff(r => {
      r.error('foobar');
    }),
  ).toMatchSnapshot();
});

test('BufferReporter.info', async () => {
  expect(
    await getBuff(r => {
      r.info('foobar');
    }),
  ).toMatchSnapshot();
});

test('BufferReporter.command', async () => {
  expect(
    await getBuff(r => {
      r.command('foobar');
    }),
  ).toMatchSnapshot();
});

test('BufferReporter.warn', async () => {
  expect(
    await getBuff(r => {
      r.warn('foobar');
    }),
  ).toMatchSnapshot();
});
