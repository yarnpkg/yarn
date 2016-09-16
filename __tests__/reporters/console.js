/* @flow */

import type {MockData} from './_mock.js';
import ProgressBar from '../../src/reporters/console/progress-bar.js';
import Spinner from '../../src/reporters/console/spinner-progress.js';
import ConsoleReporter from '../../src/reporters/console/console-reporter.js';
import build from './_mock.js';

let getConsoleBuff = build(ConsoleReporter, (data): MockData => data);
let stream = require('stream');

test('ConsoleReporter.step', async () => {
  expect(await getConsoleBuff((r) => {
    r.step(1, 5, 'foboar');
  })).toMatchSnapshot();
});

test('ConsoleReporter.header', async () => {
  expect(await getConsoleBuff((r) => {
    r.header('foobar', {name: 'kpm', version: '0.0.0'});
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

test('ConsoleReporter.activity', async () => {
  expect(await getConsoleBuff(function(r) {
    let activity = r.activity();
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

    let res = await r.select('Ayo', 'Select one', [{
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
  expect(await getConsoleBuff(async function (r): Promise<void> {
    let tick = r.progress(2);
    tick();
    jest.runAllTimers();
    tick();
  })).toMatchSnapshot();

  expect(await getConsoleBuff(async function (r): Promise<void> {
    let tick = r.progress(0);
    tick();
  })).toMatchSnapshot();

  expect(await getConsoleBuff(async function (r): Promise<void> {
    r.isTTY = false;
    let tick = r.progress(2);
    tick();
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
  let bar = new ProgressBar(2, new TestStream());

  bar.render();
  expect(data).toBe('\u001b[2K\u001b[1G░░ 0/2');

  bar.tick();
  bar.render();
  expect(data).toBe('\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2');

  bar.tick();
  bar.render();
  expect(data).toBe('\u001b[2K\u001b[1G░░ 0/2\u001b[2K\u001b[1G█░ 1/2\u001b[2K\u001b[1G\u001b[2K\u001b[1G██ 2/2');
});

test('Spinner', () => {
  let data = '';

  class TestStream extends stream.Writable {
    write(chunk: Buffer | string): boolean {
      data += String(chunk);
      return true;
    }
  }
  let spinner = new Spinner(new TestStream());

  spinner.start();
  expect(data).toBe('\u001b[2K\u001b[1G⠁ ');

  spinner.setText('foo');
  spinner.render();
  expect(data).toBe('\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo');

  spinner.setText('bar');
  spinner.render();
  expect(data).toBe('\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo\u001b[2K\u001b[1G⠄ bar');

  spinner.stop();
  expect(data).toBe('\u001b[2K\u001b[1G⠁ \u001b[2K\u001b[1G⠂ foo\u001b[2K\u001b[1G⠄ bar\u001b[2K\u001b[1G');
});
