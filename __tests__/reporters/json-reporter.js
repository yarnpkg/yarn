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

test('JSONReporter.auditAction', async () => {
  expect(
    await getJSONBuff(r => {
      r.auditAction({
        cmd: 'yarn upgrade gulp@4.0.0',
        isBreaking: true,
        action: {
          action: 'install',
          module: 'gulp',
          target: '4.0.0',
          isMajor: true,
          resolves: [],
        },
      });
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.auditAdvisory', async () => {
  expect(
    await getJSONBuff(r => {
      r.auditAdvisory(
        {
          id: 118,
          path: 'gulp>vinyl-fs>glob-stream>minimatch',
          dev: false,
          optional: false,
          bundled: false,
        },
        {
          findings: [
            {
              bundled: false,
              optional: false,
              dev: false,
              paths: [],
              version: '',
            },
          ],
          id: 118,
          created: '2016-05-25T16:37:20.000Z',
          updated: '2018-03-01T21:58:01.072Z',
          deleted: null,
          title: 'Regular Expression Denial of Service',
          found_by: {name: 'Nick Starke'},
          reported_by: {name: 'Nick Starke'},
          module_name: 'minimatch',
          cves: ['CVE-2016-10540'],
          vulnerable_versions: '<=3.0.1',
          patched_versions: '>=3.0.2',
          overview: '',
          recommendation: 'Update to version 3.0.2 or later.',
          references: '',
          access: 'public',
          severity: 'high',
          cwe: 'CWE-400',
          metadata: {
            module_type: 'Multi.Library',
            exploitability: 4,
            affected_components: '',
          },
          url: 'https://nodesecurity.io/advisories/118',
        },
      );
    }),
  ).toMatchSnapshot();
});

test('JSONReporter.auditSummary', async () => {
  expect(
    await getJSONBuff(r => {
      r.auditSummary({
        vulnerabilities: {
          info: 0,
          low: 1,
          moderate: 0,
          high: 4,
          critical: 0,
        },
        dependencies: 29105,
        devDependencies: 0,
        optionalDependencies: 0,
        totalDependencies: 29105,
      });
    }),
  ).toMatchSnapshot();
});
