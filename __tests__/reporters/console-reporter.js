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
// $FlowFixMe - flow-typed doesn't have definitions for Chalk 2.x.x
require('chalk').level = 2;
require('chalk').blue._styles[0].open = '\u001b[34m';
require('chalk').bold._styles[0].close = '\u001b[22m';

test('ConsoleReporter.step', async () => {
  expect(
    await getConsoleBuff(r => {
      r.step(1, 5, 'foboar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.header', async () => {
  expect(
    await getConsoleBuff(r => {
      r.header('foobar', {name: 'yarn', version: '0.0.0'});
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.footer', async () => {
  expect(
    await getConsoleBuff(r => {
      r.footer(false);
    }),
  ).toMatchSnapshot();

  expect(
    await getConsoleBuff(r => {
      r.footer(true);
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.log', async () => {
  expect(
    await getConsoleBuff(r => {
      r.log('foobar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.success', async () => {
  expect(
    await getConsoleBuff(r => {
      r.success('foobar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.error', async () => {
  expect(
    await getConsoleBuff(r => {
      r.error('foobar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.info', async () => {
  expect(
    await getConsoleBuff(r => {
      r.info('foobar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.command', async () => {
  expect(
    await getConsoleBuff(r => {
      r.command('foobar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.warn', async () => {
  expect(
    await getConsoleBuff(r => {
      r.warn('foobar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.tree', async () => {
  const trees = [
    {name: 'dep1'},
    {
      name: 'dep2',
      children: [
        {
          name: 'dep2.1',
          children: [{name: 'dep2.1.1'}, {name: 'dep2.1.2'}],
        },
        {
          name: 'dep2.2',
          children: [{name: 'dep2.2.1'}, {name: 'dep2.2.2'}],
        },
      ],
    },
    {
      name: 'dep3',
      children: [{name: 'dep3.1'}, {name: 'dep3.2'}],
    },
  ];
  expect(
    await getConsoleBuff(r => {
      r.tree('', trees);
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.activity', async () => {
  expect(
    await getConsoleBuff(function(r) {
      const activity = r.activity();
      activity.tick('foo');
      activity.end();
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.select', async () => {
  expect(
    await getConsoleBuff(async function(r, streams): Promise<void> {
      streams.stdin.on('resume', function() {
        streams.stdin.send('1\n', 'ascii');
        streams.stdin.end();
      });

      const res = await r.select('Ayo?', 'Select one', [
        {
          name: 'foo',
          value: 'foo',
        },
        {
          name: 'bar',
          value: 'bar',
        },
      ]);
      expect(res).toBe('foo');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.progress', async () => {
  jest.useFakeTimers();
  expect(
    await getConsoleBuff(r => {
      r.noProgress = false; // we need this to override is-ci when running tests on ci
      const tick = r.progress(2);
      tick();
      jest.runAllTimers();
      tick();
    }),
  ).toMatchSnapshot();

  expect(
    await getConsoleBuff(r => {
      const tick = r.progress(0);
      tick();
    }),
  ).toMatchSnapshot();

  expect(
    await getConsoleBuff(r => {
      r.isTTY = false;
      const tick = r.progress(2);
      tick();
      tick();
    }),
  ).toMatchSnapshot();

  expect(
    await getConsoleBuff(r => {
      r.noProgress = true;
      const tick = r.progress(2);
      tick();
    }),
  ).toMatchSnapshot();
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

test('close', async () => {
  jest.useFakeTimers();
  expect(
    await getConsoleBuff(r => {
      r.noProgress = false; // we need this to override is-ci when running tests on ci
      const tick = r.progress(2);
      tick();
      jest.runAllTimers();
      tick();

      const activity = r.activity();
      activity.tick('foo');

      r.close();
      // .close() should stop all timers and activities
      jest.runAllTimers();
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.log is silent when isSilent is true', async () => {
  const getConsoleBuff = build(ConsoleReporter, (data): MockData => data, null, {isSilent: true});
  expect(
    await getConsoleBuff(r => {
      r.log('foobar');
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.tree is silent when isSilent is true', async () => {
  const getConsoleBuff = build(ConsoleReporter, (data): MockData => data, null, {isSilent: true});
  const trees = [
    {name: 'dep1'},
    {
      name: 'dep2',
      children: [
        {
          name: 'dep2.1',
          children: [{name: 'dep2.1.1'}, {name: 'dep2.1.2'}],
        },
        {
          name: 'dep2.2',
          children: [{name: 'dep2.2.1'}, {name: 'dep2.2.2'}],
        },
      ],
    },
    {
      name: 'dep3',
      children: [{name: 'dep3.1'}, {name: 'dep3.2'}],
    },
  ];
  expect(
    await getConsoleBuff(r => {
      r.tree('', trees);
    }),
  ).toMatchSnapshot();
});

test('ConsoleReporter.auditSummary', async () => {
  const auditData = {
    actions: [
      {
        action: 'install',
        module: 'minimatch',
        target: '3.0.4',
        isMajor: true,
        resolves: [
          {
            id: 118,
            path: 'minimatch',
            dev: false,
            optional: false,
            bundled: false,
          },
        ],
      },
    ],
    advisories: {
      '118': {
        findings: [
          {
            version: '1.0.0',
            paths: ['minimatch'],
            dev: false,
            optional: false,
            bundled: false,
          },
        ],
        id: 118,
        created: '2016-05-25T16:37:20.000Z',
        updated: '2018-03-01T21:58:01.072Z',
        deleted: null,
        title: 'Regular Expression Denial of Service',
        found_by: {
          name: 'Nick Starke',
        },
        reported_by: {
          name: 'Nick Starke',
        },
        module_name: 'minimatch',
        cves: ['CVE-2016-10540'],
        vulnerable_versions: '<=3.0.1',
        patched_versions: '>=3.0.2',
        // $FlowFixMe
        overview: 'Affected versions of `minimatch` are vulnerable to regular expression denial of service attacks when user input is passed into the `pattern` argument of `minimatch(path, pattern)`.\n\n\n## Proof of Concept\n```\nvar minimatch = require(“minimatch”);\n\n// utility function for generating long strings\nvar genstr = function (len, chr) {\n  var result = “”;\n  for (i=0; i<=len; i++) {\n    result = result + chr;\n  }\n  return result;\n}\n\nvar exploit = “[!” + genstr(1000000, “\\\\”) + “A”;\n\n// minimatch exploit.\nconsole.log(“starting minimatch”);\nminimatch(“foo”, exploit);\nconsole.log(“finishing minimatch”);\n```',
        recommendation: 'Update to version 3.0.2 or later.',
        references: '',
        access: 'public',
        severity: 'high',
        cwe: 'CWE-400',
        metadata: {
          module_type: 'Multi.Library',
          exploitability: 4,
          affected_components: "Internal::Code::Function::minimatch({type:'args', key:0, vector:{type:'string'}})",
        },
        url: 'https://nodesecurity.io/advisories/118',
      },
    },
    muted: [],
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 1,
        critical: 0,
      },
      dependencies: 5,
      devDependencies: 0,
      optionalDependencies: 0,
      totalDependencies: 5,
    },
  };

  expect(
    await getConsoleBuff(r => {
      r.auditSummary(auditData);
    }),
  ).toMatchSnapshot();
});
