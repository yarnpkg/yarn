/* @flow */

import EventReporter from '../../src/reporters/event-reporter.js';
import build from './_mock.js';

type Events = Array<Object>;

const getBuff = build(
  EventReporter,
  (data, reporter: any, events: Events): Events => events,
  (reporter: any): Events => {
    const events: Events = [];
    reporter.emit = (type: string, data: any) => {
      events.push({type, data});
    };
    return events;
  },
);

test('EventReporter.finished', async () => {
  expect(
    await getBuff(r => {
      r.footer(false);
    }),
  ).toMatchSnapshot();
});

test('EventReporter.step', async () => {
  expect(
    await getBuff(r => {
      r.step(1, 5, 'foobar');
    }),
  ).toMatchSnapshot();
});

test('EventReporter.log', async () => {
  expect(
    await getBuff(r => {
      r.log('foobar');
    }),
  ).toMatchSnapshot();
});

test('EventReporter.success', async () => {
  expect(
    await getBuff(r => {
      r.success('foobar');
    }),
  ).toMatchSnapshot();
});

test('EventReporter.error', async () => {
  expect(
    await getBuff(r => {
      r.error('foobar');
    }),
  ).toMatchSnapshot();
});

test('EventReporter.info', async () => {
  expect(
    await getBuff(r => {
      r.info('foobar');
    }),
  ).toMatchSnapshot();
});

test('EventReporter.command', async () => {
  expect(
    await getBuff(r => {
      r.command('foobar');
    }),
  ).toMatchSnapshot();
});

test('EventReporter.warn', async () => {
  expect(
    await getBuff(r => {
      r.warn('foobar');
    }),
  ).toMatchSnapshot();
});
