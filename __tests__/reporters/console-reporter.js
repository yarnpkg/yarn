/* @flow */

import type {MockData} from './_mock.js';
import ProgressBar from '../../src/reporters/console/progress-bar.js';
import Spinner from '../../src/reporters/console/spinner-progress.js';
import ConsoleReporter from '../../src/reporters/console/console-reporter.js';
import build from './_mock.js';

const getConsoleBuff = build(ConsoleReporter, (data): MockData => data);
const stream = require('stream');

// ensures consistency across environments
require('chalk').enabled = true;
require('chalk').supportsColor = true;
require('chalk').styles.blue.open = '\u001b[34m';

test('ConsoleReporter.step', async () => {
  expect(await getConsoleBuff((r) => {
    r.step(1, 5, 'foboar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.header', async () => {
  expect(await getConsoleBuff((r) => {
    r.header('foobar', {name: 'yarn', version: '0.0.0'});
  })).toMatchSnapshot();
});

test('ConsoleReporter.footer', async () => {
  expect(await getConsoleBuff((r) => {
    r.footer(false);
  })).toMatchSnapshot();

  expect(await getConsoleBuff((r) => {
    r.footer(true);
  })).toMatchSnapshot();
});

test('ConsoleReporter.log', async () => {
  expect(await getConsoleBuff((r) => {
    r.log('foobar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.success', async () => {
  expect(await getConsoleBuff((r) => {
    r.success('foobar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.error', async () => {
  expect(await getConsoleBuff((r) => {
    r.error('foobar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.info', async () => {
  expect(await getConsoleBuff((r) => {
    r.info('foobar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.command', async () => {
  expect(await getConsoleBuff((r) => {
    r.command('foobar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.warn', async () => {
  expect(await getConsoleBuff((r) => {
    r.warn('foobar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.tree', async () => {
  const trees = [
    {name: 'dep1'},
    {
      name: 'dep2',
      children: [
        {
          name: 'dep2.1',
          children: [
            {name: 'dep2.1.1'},
            {name: 'dep2.1.2'},
          ],
        },
        {
          name: 'dep2.2',
          children: [
            {name: 'dep2.2.1'},
            {name: 'dep2.2.2'},
          ],
        },
      ],
    },
    {
      name: 'dep3',
      children: [
        {name: 'dep3.1'},
        {name: 'dep3.2'},
      ],
    },
  ];
  expect(await getConsoleBuff((r) => {
    r.tree('', trees);
  })).toMatchSnapshot();
});

test('ConsoleReporter.activity', async () => {
  expect(await getConsoleBuff(function(r) {
    const activity = r.activity();
    activity.tick('foo');
    activity.end();
  })).toMatchSnapshot();
});

test('ConsoleReporter.select', async () => {
  expect(await getConsoleBuff(async function (r, streams): Promise<void> {
    streams.stdin.on('resume', function() {
      streams.stdin.send('1\n', 'ascii');
      streams.stdin.end();
    });

    const res = await r.select('Ayo?', 'Select one', [{
      name: 'foo',
      value: 'foo',
    }, {
      name: 'bar',
      value: 'bar',
    }]);
    expect(res, 'foo');
  })).toMatchSnapshot();
});

test('ConsoleReporter.progress', async () => {
  expect(await getConsoleBuff((r) => {
    r.noProgress = false; // we need this to override is-ci when running tests on ci
    const tick = r.progress(2);
    tick();
    jest.runAllTimers();
    tick();
  })).toMatchSnapshot();

  expect(await getConsoleBuff((r) => {
    const tick = r.progress(0);
    tick();
  })).toMatchSnapshot();

  expect(await getConsoleBuff((r) => {
    r.isTTY = false;
    const tick = r.progress(2);
    tick();
    tick();
  })).toMatchSnapshot();

  expect(await getConsoleBuff((r) => {
    r.noProgress = true;
    const tick = r.progress(2);
    tick();
  })).toMatchSnapshot();
});

test('ProgressBar', () => {
  let data = '';

  class TestStream extends stream.Writable {
    columns: number;
    constructor(options) {
      super(options);
      this.columns = 1000;
    }
    write(chunk: Buffer | string): boolean {
      data += String(chunk);
      return true;
    }
  }
  const bar = new ProgressBar(2, new TestStream());

  bar.render();
  expect(data).toMatchSnapshot();

  bar.tick();
  bar.render();
  expect(data).toMatchSnapshot();

  bar.tick();
  bar.render();
  expect(data).toMatchSnapshot();
});

test('Spinner', () => {
  let data = '';

  class TestStream extends stream.Writable {
    write(chunk: Buffer | string): boolean {
      data += String(chunk);
      return true;
    }
  }
  const spinner = new Spinner(new TestStream());

  spinner.start();
  expect(data).toMatchSnapshot();

  spinner.setText('foo');
  spinner.render();
  expect(data).toMatchSnapshot();

  spinner.setText('bar');
  spinner.render();
  expect(data).toMatchSnapshot();

  spinner.stop();
  expect(data).toMatchSnapshot();
});
